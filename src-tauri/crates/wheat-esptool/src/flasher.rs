//! 高层烧录器：连接、芯片识别、stub 加载、烧录 / 读取 / 擦除 / 设备信息。
//!
//! 流程移植自 esptool（`esptool/loader.py` + `esptool/cmds.py`），
//! 接口按 wheat-esp-tools 的交互需求设计（字节级进度事件、可中断的分段操作）。

use std::io::Write;
use std::{thread::sleep, time::Duration};

use flate2::write::{ZlibDecoder, ZlibEncoder};
use flate2::Compression;
use md5::{Digest, Md5};

use crate::cancel::CancelToken;
use crate::chips::{find_by_chip_id, find_by_magic, ChipDefinition};
use crate::command::{self, Cmd};
use crate::connection::{Connection, SecurityInfo};
use crate::error::{Error, Result};
use crate::progress::{ProgressEvent, ProgressSink};
use crate::reset::{ResetAfter, ResetBefore};

/// Flash 扇区大小（擦除对齐单位）。
pub const FLASH_SECTOR_SIZE: usize = 0x1000;
/// stub 加载时的 RAM 写块大小。
const RAM_BLOCK_SIZE: usize = 0x1800;
/// stub 加载完成后的握手内容。
const STUB_HANDSHAKE: &[u8] = b"OHAI";
/// READ_FLASH 单包大小。
pub const READ_PACKET_SIZE: u32 = 0x1000;
/// READ_FLASH 允许的最大未确认包数（越大越快，对串口质量要求越高）。
pub const READ_MAX_IN_FLIGHT: u32 = 64;

/// 一个待烧录的段。
#[derive(Debug, Clone)]
pub struct Segment {
    pub addr: u32,
    pub data: Vec<u8>,
}

/// 连接参数。
#[derive(Debug, Clone)]
pub struct ConnectConfig {
    /// 串口名（如 `COM5`）。
    pub port: String,
    /// 目标波特率；连接固定以 115200 建立，成功后再切换。
    pub baud: u32,
    /// 进 bootloader 前的复位方式。
    pub before: ResetBefore,
    /// 操作完成后的复位方式。
    pub after: ResetAfter,
    /// 是否加载 stub（强烈推荐；READ_FLASH / 整片擦除依赖 stub）。
    pub use_stub: bool,
}

impl Default for ConnectConfig {
    fn default() -> Self {
        Self {
            port: String::new(),
            baud: 115_200,
            before: ResetBefore::DefaultReset,
            after: ResetAfter::HardReset,
            use_stub: true,
        }
    }
}

/// 设备信息汇总。
#[derive(Debug, Clone)]
pub struct DeviceInfo {
    /// 芯片名，如 `"ESP32-S3"`。
    pub chip: String,
    /// 芯片版本 (major, minor)。
    pub revision: Option<(u32, u32)>,
    /// 晶振频率（MHz）。
    pub crystal_mhz: u32,
    /// Flash 容量（字节），探测失败为 None。
    pub flash_size_bytes: Option<u32>,
    /// 芯片特性。
    pub features: Vec<String>,
    /// MAC 地址（Secure Download Mode 下不可读）。
    pub mac: Option<String>,
}

/// flash id 的 size 字节 → 容量（字节）。
pub fn flash_size_from_id(size_id: u8) -> Option<u32> {
    let bytes: u32 = match size_id {
        0x12 | 0x32 => 0x4_0000,      // 256KB
        0x13 | 0x33 => 0x8_0000,      // 512KB
        0x14 | 0x34 => 0x10_0000,     // 1MB
        0x15 | 0x35 => 0x20_0000,     // 2MB
        0x16 | 0x36 => 0x40_0000,     // 4MB
        0x17 | 0x37 => 0x80_0000,     // 8MB
        0x18 | 0x38 => 0x100_0000,    // 16MB
        0x19 | 0x39 => 0x200_0000,    // 32MB
        0x20 | 0x1A | 0x3A => 0x400_0000, // 64MB
        0x21 | 0x1B => 0x800_0000,    // 128MB
        0x22 | 0x1C => 0x1000_0000,   // 256MB
        _ => return None,
    };
    Some(bytes)
}

/// 容量 → 人类可读标签（"4MB" / "512KB"）。
pub fn flash_size_label(bytes: u32) -> String {
    if bytes >= 1024 * 1024 {
        format!("{}MB", bytes / (1024 * 1024))
    } else if bytes >= 1024 {
        format!("{}KB", bytes / 1024)
    } else {
        format!("{bytes}B")
    }
}

/// SPI Flash 引脚附加参数。
#[derive(Debug, Clone, Copy)]
struct SpiAttachParams {
    clk: u8,
    q: u8,
    d: u8,
    hd: u8,
    cs: u8,
}

impl SpiAttachParams {
    const fn default_pins() -> Self {
        SpiAttachParams {
            clk: 0,
            q: 0,
            d: 0,
            hd: 0,
            cs: 0,
        }
    }

    /// ESP32-PICO-D4 的特殊引脚映射。
    const fn esp32_pico_d4() -> Self {
        SpiAttachParams {
            clk: 6,
            q: 17,
            d: 8,
            hd: 11,
            cs: 16,
        }
    }

    fn encode(self, stub: bool) -> Vec<u8> {
        let packed = ((self.hd as u32) << 24)
            | ((self.cs as u32) << 18)
            | ((self.d as u32) << 12)
            | ((self.q as u32) << 6)
            | (self.clk as u32);
        let mut out = packed.to_le_bytes().to_vec();
        if !stub {
            // ROM loader 需要额外 4 字节 0
            out.extend_from_slice(&[0u8; 4]);
        }
        out
    }
}

/// 统计写入字节数的 sink（解压进度跟踪用）。
struct CountingWriter {
    count: u64,
}

impl Write for CountingWriter {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.count += buf.len() as u64;
        Ok(buf.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

/// 已连接的烧录器。
pub struct Flasher {
    conn: Connection,
    chip: &'static dyn ChipDefinition,
    revision: Option<(u32, u32)>,
    after: ResetAfter,
    flash_size_bytes: Option<u32>,
    /// 写操作后是否还欠一条 FLASH(_DEFL)_END。
    need_flash_end: bool,
    /// 协作式取消令牌（写入逐块 / 读取逐包边界检查）。
    cancel: CancelToken,
}

impl Flasher {
    /// 连接设备：复位 → 同步 → 识别芯片 → 加载 stub → 探测 Flash → 切波特率。
    pub fn connect(cfg: &ConnectConfig, progress: &mut dyn ProgressSink) -> Result<Self> {
        progress.event(ProgressEvent::OpeningPort {
            port: cfg.port.clone(),
        });
        let mut conn = Connection::open(&cfg.port)?;

        progress.event(ProgressEvent::Connecting {
            use_stub: cfg.use_stub,
        });
        conn.begin(cfg.before)?;

        // 识别芯片 + 检测 Secure Download Mode：
        // 新芯片的 ROM 支持 GET_SECURITY_INFO（带 chip_id）；
        // 老芯片（ESP32/S2）回落到 magic 寄存器。
        let mut secure_download_mode = false;
        let chip: &'static dyn ChipDefinition = match conn.security_info() {
            Ok(info) => {
                secure_download_mode = info.secure_download_enabled();
                let by_id = info
                    .chip_id
                    .and_then(|id| find_by_chip_id(id as u16));
                match by_id {
                    Some(chip) => chip,
                    None => Self::detect_by_magic(&mut conn)?,
                }
            }
            Err(_) => match conn.read_chip_magic() {
                Ok(magic) => find_by_magic(magic).ok_or_else(|| {
                    Error::ChipDetect(format!("magic:0x{magic:08X}"))
                })?,
                Err(_) => {
                    // 老芯片开启 SDM 后寄存器不可读
                    return Err(Error::ChipDetect("secure_download_mode".into()));
                }
            },
        };
        conn.secure_download_mode = secure_download_mode;

        let revision = if !secure_download_mode {
            chip.revision(&mut conn).ok()
        } else {
            None
        };

        progress.event(ProgressEvent::ChipDetected {
            chip: chip.name(),
            revision,
        });

        let mut flasher = Flasher {
            conn,
            chip,
            revision,
            after: cfg.after,
            flash_size_bytes: None,
            need_flash_end: false,
            cancel: CancelToken::default(),
        };

        if !flasher.conn.secure_download_mode {
            // 芯片专属准备动作（如 ESP32-P4 Flash 上电）
            chip.post_connect(&mut flasher.conn, revision)?;

            // 部分新芯片（ESP32-H21 / E22）官方尚未发布 stub，回落 ROM loader
            if cfg.use_stub && chip.stub_source(revision).is_some() {
                flasher.load_stub()?;
                progress.event(ProgressEvent::StubReady);
            }

            flasher.spi_autodetect()?;
            if let Some(size) = flasher.flash_size_bytes {
                progress.event(ProgressEvent::FlashDetected { size_bytes: size });
            }
        }

        if cfg.baud > 115_200 {
            flasher.change_baud(cfg.baud)?;
            progress.event(ProgressEvent::BaudChanged { baud: cfg.baud });
        }

        Ok(flasher)
    }

    fn detect_by_magic(conn: &mut Connection) -> Result<&'static dyn ChipDefinition> {
        let magic = conn.read_chip_magic()?;
        find_by_magic(magic).ok_or_else(|| Error::ChipDetect(format!("magic:0x{magic:08X}")))
    }

    /// 芯片名称（如 `"ESP32-C3"`）。
    pub fn chip_name(&self) -> &'static str {
        self.chip.name()
    }

    /// 芯片版本。
    pub fn revision(&self) -> Option<(u32, u32)> {
        self.revision
    }

    /// 连接时探测到的 Flash 容量（字节）。
    pub fn flash_size_bytes(&self) -> Option<u32> {
        self.flash_size_bytes
    }

    /// 是否处于 Secure Download Mode。
    pub fn secure_download_mode(&self) -> bool {
        self.conn.secure_download_mode
    }

    /// 是否已加载 stub。
    pub fn stub_active(&self) -> bool {
        self.conn.stub_active()
    }

    /// 注入取消令牌。令牌被 `cancel()` 后，写入 / 读取会在下一个
    /// 包边界返回 [`Error::Cancelled`]（正在执行中的单条命令无法中断）。
    pub fn set_cancel_token(&mut self, token: CancelToken) {
        self.cancel = token;
    }

    fn check_cancel(&self) -> Result<()> {
        if self.cancel.is_cancelled() {
            Err(Error::Cancelled)
        } else {
            Ok(())
        }
    }

    // ------------------------------------------------------------------
    // 连接内部流程
    // ------------------------------------------------------------------

    /// 把 stub 写进 RAM 并执行，等待 "OHAI" 握手。
    fn load_stub(&mut self) -> Result<()> {
        let stub = self
            .chip
            .stub(self.revision)?
            .ok_or(Error::Unsupported { what: "stub" })?;

        for (start, payload) in [(stub.text_start, &stub.text), (stub.data_start, &stub.data)] {
            let blocks = payload.len().div_ceil(RAM_BLOCK_SIZE);
            self.conn.command(
                Cmd::MemBegin,
                &command::le32(&[
                    payload.len() as u32,
                    blocks as u32,
                    RAM_BLOCK_SIZE as u32,
                    start,
                ]),
                0,
            )?;
            for (seq, block) in payload.chunks(RAM_BLOCK_SIZE).enumerate() {
                let (data, checksum) = command::data_payload(block, 4, 0, seq as u32);
                self.conn.command(Cmd::MemData, &data, checksum)?;
            }
        }

        // MEM_END：跳转到 stub 入口
        self.conn.command_with_timeout(
            Cmd::MemEnd,
            &command::le32(&[0, stub.entry]),
            0,
            command::MEM_END_TIMEOUT,
        )?;

        // stub 启动后主动发送 "OHAI"
        let frame = self
            .conn
            .read_exact_frame_bytes(STUB_HANDSHAKE.len(), Duration::from_secs(3))?;
        if &frame[..STUB_HANDSHAKE.len()] != STUB_HANDSHAKE {
            return Err(Error::StubHandshake);
        }

        self.conn.set_stub_active();
        Ok(())
    }

    /// 依次尝试 SPI 引脚组合，attach 并探测 Flash 容量。
    fn spi_autodetect(&mut self) -> Result<()> {
        for params in [
            SpiAttachParams::default_pins(),
            SpiAttachParams::esp32_pico_d4(),
        ] {
            // attach 偶尔失败但 flash 探测仍能成功，忽略错误
            let _ = self.spi_attach(params);

            if let Some(size_bytes) = self.flash_detect()? {
                self.flash_size_bytes = Some(size_bytes);

                // 告知 loader Flash 参数（写入越界检查依赖它）；
                // ESP8266 ROM 无此命令（stub 支持），跳过不影响写入
                if self.conn.stub_active() || self.chip.supports_spi_attach() {
                    let data = command::le32(&[
                        0,          // fl_id
                        size_bytes, // total_size
                        64 * 1024,  // block_size
                        4 * 1024,   // sector_size
                        256,        // page_size
                        0xFFFF,     // status_mask
                    ]);
                    self.conn.command(Cmd::SpiSetParams, &data, 0)?;
                }
                return Ok(());
            }
        }
        // 探测不到容量也不阻塞（写入仍可进行），只是 size 未知
        self.flash_size_bytes = None;
        Ok(())
    }

    fn spi_attach(&mut self, params: SpiAttachParams) -> Result<()> {
        if self.conn.stub_active() || self.chip.supports_spi_attach() {
            let data = params.encode(self.conn.stub_active());
            self.conn.command(Cmd::SpiAttach, &data, 0)?;
        } else {
            // ESP8266 ROM 无 SPI_ATTACH 命令，用空 FLASH_BEGIN 隐式附加 flash
            self.conn
                .command(Cmd::FlashBegin, &command::le32(&[0, 0, 0, 0]), 0)?;
        }
        Ok(())
    }

    /// 通过 SPI RDID (0x9F) 命令读取 flash id 并解析容量。
    fn flash_detect(&mut self) -> Result<Option<u32>> {
        const FLASH_RETRY: u8 = 0xFF;
        let flash_id = self.run_spiflash_command(0x9F, &[], 24)?;
        let size_id = (flash_id >> 16) as u8;
        if size_id == FLASH_RETRY {
            return Ok(None);
        }
        Ok(flash_size_from_id(size_id))
    }

    /// 直接操作 SPI 控制器寄存器执行一条 SPI Flash 命令（如 RDID）。
    fn run_spiflash_command(&mut self, spi_cmd: u8, data: &[u8], read_bits: u32) -> Result<u32> {
        assert!(read_bits < 32);
        assert!(data.len() < 64);

        let regs = self.chip.spi_registers();

        let old_usr = self.conn.read_reg(regs.usr())?;
        let old_usr2 = self.conn.read_reg(regs.usr2())?;

        let mut flags: u32 = 1 << 31; // SPI_USR_COMMAND
        if !data.is_empty() {
            flags |= 1 << 27; // SPI_USR_MOSI
        }
        if read_bits > 0 {
            flags |= 1 << 28; // SPI_USR_MISO
        }

        self.conn.write_reg(regs.usr(), flags, None)?;
        self.conn
            .write_reg(regs.usr2(), (7 << 28) | spi_cmd as u32, None)?;

        let mosi_bits = data.len() as u32 * 8;
        match (regs.mosi_length(), regs.miso_length()) {
            (Some(mosi_reg), Some(miso_reg)) => {
                if mosi_bits > 0 {
                    self.conn.write_reg(mosi_reg, mosi_bits - 1, None)?;
                }
                if read_bits > 0 {
                    self.conn.write_reg(miso_reg, read_bits - 1, None)?;
                }
            }
            _ => {
                // ESP8266：无独立长度寄存器，长度打包写入 USR1
                const SPI_MOSI_BITLEN_SHIFT: u32 = 17;
                const SPI_MISO_BITLEN_SHIFT: u32 = 8;
                let mosi_mask = mosi_bits.saturating_sub(1);
                let miso_mask = read_bits.saturating_sub(1);
                self.conn.write_reg(
                    regs.usr1(),
                    (miso_mask << SPI_MISO_BITLEN_SHIFT) | (mosi_mask << SPI_MOSI_BITLEN_SHIFT),
                    None,
                )?;
            }
        }

        if data.is_empty() {
            self.conn.write_reg(regs.w0(), 0, None)?;
        } else {
            for (i, bytes) in data.chunks(4).enumerate() {
                let mut word = [0u8; 4];
                word[..bytes.len()].copy_from_slice(bytes);
                self.conn
                    .write_reg(regs.w0() + i as u32 * 4, u32::from_le_bytes(word), None)?;
            }
        }

        // 触发执行（SPI_CMD_USR），轮询完成
        self.conn.write_reg(regs.cmd(), 1 << 18, None)?;
        let mut i = 0;
        loop {
            sleep(Duration::from_millis(1));
            if self.conn.read_reg(regs.cmd())? & (1 << 18) == 0 {
                break;
            }
            i += 1;
            if i > 10 {
                return Err(Error::Timeout {
                    command: "SPI_FLASH_COMMAND",
                });
            }
        }

        let result = self.conn.read_reg(regs.w0())?;
        self.conn.write_reg(regs.usr(), old_usr, None)?;
        self.conn.write_reg(regs.usr2(), old_usr2, None)?;
        Ok(result)
    }

    /// 协议层切换波特率并同步本地串口。
    fn change_baud(&mut self, baud: u32) -> Result<()> {
        let prior = if self.conn.stub_active() {
            self.conn.baud()
        } else {
            0
        };

        // ESP32-C2 的 ROM 假定 40MHz 晶振；26MHz 板子需要折算
        let mut new_baud = baud;
        if self.chip.name() == "ESP32-C2" && !self.conn.stub_active() {
            if let Ok(26) = self.chip.xtal_mhz(&mut self.conn) {
                new_baud = new_baud * 40 / 26;
            }
        }

        self.conn
            .command(Cmd::ChangeBaudrate, &command::le32(&[new_baud, prior]), 0)?;
        self.conn.set_baud(baud)?;
        sleep(Duration::from_millis(50));
        self.conn.clear_input()?;
        Ok(())
    }

    // ------------------------------------------------------------------
    // 烧录
    // ------------------------------------------------------------------

    /// 烧录多个段。stub 模式走 zlib 压缩传输，进度按解压后（真实）字节推送。
    pub fn write_flash(
        &mut self,
        segments: &[Segment],
        verify: bool,
        progress: &mut dyn ProgressSink,
    ) -> Result<()> {
        for (index, segment) in segments.iter().enumerate() {
            self.check_cancel()?;
            self.write_segment(index, segments.len(), segment, verify, progress)?;
        }
        self.flash_end()?;
        Ok(())
    }

    fn write_segment(
        &mut self,
        index: usize,
        count: usize,
        segment: &Segment,
        verify: bool,
        progress: &mut dyn ProgressSink,
    ) -> Result<()> {
        let addr = segment.addr;
        let total_bytes = segment.data.len() as u64;
        let use_compression = self.conn.stub_active();

        let local_md5: [u8; 16] = {
            let mut hasher = Md5::new();
            hasher.update(&segment.data);
            hasher.finalize().into()
        };

        // 扇区对齐大小（超时换算用）
        let aligned_size =
            (segment.data.len().div_ceil(FLASH_SECTOR_SIZE) * FLASH_SECTOR_SIZE) as u32;

        let block_size = if use_compression {
            self.chip.flash_write_size_stub()
        } else {
            self.chip.flash_write_size_rom()
        };

        let payload: Vec<u8> = if use_compression {
            let mut encoder = ZlibEncoder::new(Vec::new(), Compression::best());
            encoder.write_all(&segment.data)?;
            encoder.finish()?
        } else {
            segment.data.clone()
        };

        let blocks = payload.len().div_ceil(block_size);

        progress.event(ProgressEvent::SegmentStart {
            index,
            count,
            addr,
            total_bytes,
            transfer_bytes: payload.len() as u64,
            blocks,
        });

        if use_compression {
            // stub：size 传未压缩的精确字节数
            self.conn.command_with_timeout(
                Cmd::FlashDeflBegin,
                &command::le32(&[
                    segment.data.len() as u32,
                    blocks as u32,
                    block_size as u32,
                    addr,
                ]),
                0,
                Cmd::FlashDeflBegin.timeout_for_size(aligned_size),
            )?;
        } else {
            // ROM loader 擦除长度按芯片折算（ESP8266 ROM 有擦除 bug）
            let erase_size = self.chip.rom_erase_size(addr, segment.data.len() as u32);
            let mut begin = command::le32(&[erase_size, blocks as u32, block_size as u32, addr]);
            if self.chip.rom_flash_begin_has_encrypt_flag() {
                // ESP32-S2 及之后的 ROM 需要 encrypted 参数字
                begin.extend_from_slice(&0u32.to_le_bytes());
            }
            self.conn.command_with_timeout(
                Cmd::FlashBegin,
                &begin,
                0,
                Cmd::FlashBegin.timeout_for_size(aligned_size),
            )?;
        }
        self.need_flash_end = true;

        // 压缩块解压后的大小不均匀；用真实解压字节数换算进度与超时
        let mut decode_counter = ZlibDecoder::new(CountingWriter { count: 0 });
        let mut written_bytes: u64 = 0;

        for (seq, block) in payload.chunks(block_size).enumerate() {
            self.check_cancel()?;
            let chunk_uncompressed = if use_compression {
                decode_counter.write_all(block)?;
                decode_counter.flush()?;
                let now = decode_counter.get_ref().count;
                let delta = now - written_bytes;
                written_bytes = now;
                delta
            } else {
                written_bytes += block.len() as u64;
                block.len() as u64
            };

            if use_compression {
                let (data, checksum) = command::data_payload(block, 0, 0xFF, seq as u32);
                self.conn.command_with_timeout(
                    Cmd::FlashDeflData,
                    &data,
                    checksum,
                    Cmd::FlashDeflData.timeout_for_size(chunk_uncompressed as u32),
                )?;
            } else {
                let (data, checksum) = command::data_payload(block, block_size, 0xFF, seq as u32);
                self.conn.command_with_timeout(
                    Cmd::FlashData,
                    &data,
                    checksum,
                    Cmd::FlashData.timeout_for_size(block.len() as u32),
                )?;
            }

            progress.event(ProgressEvent::WriteProgress {
                addr,
                written_bytes: written_bytes.min(total_bytes),
                total_bytes,
            });
        }

        if verify && !self.conn.secure_download_mode {
            progress.event(ProgressEvent::Verifying { addr });
            let device_md5 = self.md5_region(addr, segment.data.len() as u32)?;
            if device_md5 != local_md5 {
                return Err(Error::VerifyFailed { addr });
            }
        }

        progress.event(ProgressEvent::SegmentDone {
            addr,
            skipped: false,
        });
        Ok(())
    }

    /// 发送 FLASH(_DEFL)_END（不重启，复位交给 [`Flasher::finish`]）。
    fn flash_end(&mut self) -> Result<()> {
        if !self.need_flash_end {
            return Ok(());
        }
        self.need_flash_end = false;
        // data = 1 表示「不重启」（0 才是 reboot）
        let cmd = if self.conn.stub_active() {
            Cmd::FlashDeflEnd
        } else {
            Cmd::FlashEnd
        };
        match self.conn.command(cmd, &command::le32(&[1]), 0) {
            Ok(_) => Ok(()),
            // SDM 下 ROM 可能对未签名镜像报错，但数据已写入，视为成功
            Err(Error::Rom { .. }) if self.conn.secure_download_mode => Ok(()),
            Err(e) => Err(e),
        }
    }

    // ------------------------------------------------------------------
    // 读取
    // ------------------------------------------------------------------

    /// 流式读取 Flash（stub 专属）：数据边收边写入 `out`，最后校验 MD5。
    pub fn read_flash(
        &mut self,
        offset: u32,
        size: u32,
        out: &mut dyn Write,
        progress: &mut dyn ProgressSink,
    ) -> Result<()> {
        if !self.conn.stub_active() {
            return Err(Error::Unsupported {
                what: "read_flash_requires_stub",
            });
        }

        progress.event(ProgressEvent::ReadStart {
            addr: offset,
            total_bytes: size as u64,
        });

        self.conn.command(
            Cmd::ReadFlash,
            &command::le32(&[offset, size, READ_PACKET_SIZE, READ_MAX_IN_FLIGHT]),
            0,
        )?;

        let mut hasher = Md5::new();
        let mut received: u64 = 0;
        let total = size as u64;

        while received < total {
            self.check_cancel()?;
            let chunk = self.conn.read_raw_frame(command::DEFAULT_TIMEOUT)?;
            if chunk.is_empty() {
                continue;
            }
            if received + chunk.len() as u64 > total {
                return Err(Error::ReadMoreThanExpected);
            }
            // 非最后一包必须是整包；短包意味着丢数据
            if (chunk.len() as u32) < READ_PACKET_SIZE
                && received + chunk.len() as u64 != total
            {
                return Err(Error::CorruptData {
                    expected: READ_PACKET_SIZE as usize,
                    got: chunk.len(),
                });
            }

            hasher.update(&chunk);
            out.write_all(&chunk)?;
            received += chunk.len() as u64;

            // ACK：累计已收字节数（stub 以此控制在途包数量）
            self.conn
                .write_raw_frame(&(received as u32).to_le_bytes())?;

            progress.event(ProgressEvent::ReadProgress {
                addr: offset,
                read_bytes: received,
                total_bytes: total,
            });
        }

        // 数据流结束后 stub 发送 16 字节 MD5
        let digest_frame = self.conn.read_raw_frame(command::DEFAULT_TIMEOUT)?;
        if digest_frame.len() != 16 {
            return Err(Error::InvalidResponse(format!(
                "bad_md5_frame_len:{}",
                digest_frame.len()
            )));
        }
        let local: [u8; 16] = hasher.finalize().into();
        if digest_frame != local {
            return Err(Error::DigestMismatch);
        }

        out.flush()?;
        progress.event(ProgressEvent::ReadDone { total_bytes: total });
        Ok(())
    }

    // ------------------------------------------------------------------
    // 擦除
    // ------------------------------------------------------------------

    /// 整片擦除（stub 专属，最长两分钟）。
    pub fn erase_flash(&mut self, progress: &mut dyn ProgressSink) -> Result<()> {
        progress.event(ProgressEvent::EraseAllStart);
        self.conn.command(Cmd::EraseFlash, &[], 0)?;
        sleep(Duration::from_millis(50));
        self.conn.clear_input()?;
        progress.event(ProgressEvent::EraseAllDone);
        Ok(())
    }

    /// 区域擦除（offset / size 需 4KB 对齐，由 stub 校验）。
    pub fn erase_region(&mut self, offset: u32, size: u32) -> Result<()> {
        self.conn.command_with_timeout(
            Cmd::EraseRegion,
            &command::le32(&[offset, size]),
            0,
            Cmd::EraseRegion.timeout_for_size(size),
        )?;
        sleep(Duration::from_millis(50));
        self.conn.clear_input()?;
        Ok(())
    }

    // ------------------------------------------------------------------
    // 信息查询
    // ------------------------------------------------------------------

    /// 计算设备端某区域的 MD5。
    pub fn md5_region(&mut self, addr: u32, size: u32) -> Result<[u8; 16]> {
        let resp = self.conn.command_with_timeout(
            Cmd::FlashMd5,
            &command::le32(&[addr, size, 0, 0]),
            0,
            Cmd::FlashMd5.timeout_for_size(size),
        )?;

        if self.conn.stub_active() {
            // stub 返回 16 字节原始摘要
            let bytes: [u8; 16] = resp.data.get(..16).and_then(|b| b.try_into().ok()).ok_or_else(
                || Error::InvalidResponse(format!("bad_md5_len:{}", resp.data.len())),
            )?;
            Ok(bytes)
        } else {
            // ROM 返回 32 字符 ASCII hex
            let text = std::str::from_utf8(resp.data.get(..32).ok_or_else(|| {
                Error::InvalidResponse(format!("bad_md5_len:{}", resp.data.len()))
            })?)
            .map_err(|_| Error::InvalidResponse("md5_not_ascii".into()))?;
            let mut bytes = [0u8; 16];
            for i in 0..16 {
                bytes[i] = u8::from_str_radix(&text[i * 2..i * 2 + 2], 16)
                    .map_err(|_| Error::InvalidResponse("md5_not_hex".into()))?;
            }
            Ok(bytes)
        }
    }

    /// 读取设备信息（芯片 / 版本 / 晶振 / 特性 / MAC / Flash 容量）。
    pub fn device_info(&mut self) -> Result<DeviceInfo> {
        let crystal_mhz = self.chip.xtal_mhz(&mut self.conn)?;
        let features = self.chip.features(&mut self.conn)?;
        let mac = if self.conn.secure_download_mode {
            None
        } else {
            Some(self.chip.mac_address(&mut self.conn)?)
        };

        Ok(DeviceInfo {
            chip: self.chip.name().to_string(),
            revision: self.revision,
            crystal_mhz,
            flash_size_bytes: self.flash_size_bytes,
            features,
            mac,
        })
    }

    /// 读取安全信息；芯片不支持（ESP32）时返回 `Ok(None)`。
    pub fn security_info(&mut self) -> Result<Option<SecurityInfo>> {
        if !self.chip.supports_get_security_info() {
            return Ok(None);
        }
        Ok(Some(self.conn.security_info()?))
    }

    // ------------------------------------------------------------------
    // 收尾
    // ------------------------------------------------------------------

    /// 按连接配置的 `after` 复位设备（操作成功后调用一次）。
    pub fn finish(&mut self) -> Result<()> {
        self.flash_end()?;
        self.conn.reset_after(self.after)
    }

    /// 取消 / 失败后的清理：放弃未完成的写序列，直接按 `after` 复位，
    /// 避免设备停留在 bootloader。
    pub fn abort(&mut self) -> Result<()> {
        self.need_flash_end = false;
        self.conn.reset_after(self.after)
    }
}
