//! 串口连接层：负责打开串口、复位进 bootloader、SYNC 同步、命令收发。
//!
//! 响应包布局（SLIP 帧内）:
//! `<direction:u8=0x01> <command:u8> <size:u16 LE> <value:u32 LE> <data...> <status...>`
//!
//! status 长度：ESP32 及以后芯片的 ROM loader 为 4 字节，stub 为 2 字节，
//! 首字节非 0 表示失败，次字节为错误码。

use std::{io::Write, thread::sleep, time::Duration};

use serialport::SerialPort;

use crate::command::{self, Cmd};
use crate::error::{Error, Result};
use crate::reset::{
    hard_reset, reset_strategy_sequence, ResetAfter, ResetBefore, USB_SERIAL_JTAG_PID,
};
use crate::slip::{encode_frame, SlipDecoder};

/// 平台相关的原生串口类型。
#[cfg(unix)]
pub type Port = serialport::TTYPort;
#[cfg(windows)]
pub type Port = serialport::COMPort;

/// 与 bootloader 建立连接时的最大复位尝试次数。
const MAX_CONNECT_ATTEMPTS: usize = 7;
/// 每次复位后的最大 SYNC 尝试次数。
const MAX_SYNC_ATTEMPTS: usize = 5;

/// 芯片识别 magic 寄存器（所有 ESP32 系列在该地址都有可读值）。
pub const CHIP_DETECT_MAGIC_REG_ADDR: u32 = 0x4000_1000;

/// 一次命令的解析结果。
#[derive(Debug, Clone)]
pub struct Response {
    /// 响应头中的 32 位 value（READ_REG 等命令的返回值）。
    pub value: u32,
    /// 去掉 8 字节头和 status 字节后的数据体。
    pub data: Vec<u8>,
}

/// GET_SECURITY_INFO 的解析结果。
#[derive(Debug, Clone)]
pub struct SecurityInfo {
    pub flags: u32,
    pub flash_crypt_cnt: u8,
    pub key_purposes: [u8; 7],
    /// ESP32-S2 没有该字段。
    pub chip_id: Option<u32>,
    pub api_version: Option<u32>,
}

impl SecurityInfo {
    fn flag(&self, bit: u32) -> bool {
        self.flags & (1 << bit) != 0
    }

    pub fn secure_boot_enabled(&self) -> bool {
        self.flag(0)
    }

    pub fn secure_download_enabled(&self) -> bool {
        self.flag(2)
    }

    pub fn flash_encryption_enabled(&self) -> bool {
        !self.flash_crypt_cnt.count_ones().is_multiple_of(2)
    }

    fn parse(bytes: &[u8]) -> Result<Self> {
        if bytes.len() < 12 {
            return Err(Error::InvalidResponse(format!(
                "security_info_too_short:{}",
                bytes.len()
            )));
        }
        let flags = u32::from_le_bytes(bytes[0..4].try_into().unwrap());
        let flash_crypt_cnt = bytes[4];
        let key_purposes: [u8; 7] = bytes[5..12].try_into().unwrap();
        let (chip_id, api_version) = if bytes.len() >= 20 {
            (
                Some(u32::from_le_bytes(bytes[12..16].try_into().unwrap())),
                Some(u32::from_le_bytes(bytes[16..20].try_into().unwrap())),
            )
        } else {
            // ESP32-S2 只返回 12 字节
            (None, None)
        };
        Ok(SecurityInfo {
            flags,
            flash_crypt_cnt,
            key_purposes,
            chip_id,
            api_version,
        })
    }
}

impl std::fmt::Display for SecurityInfo {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let key_purposes = self
            .key_purposes
            .iter()
            .map(|b| b.to_string())
            .collect::<Vec<_>>()
            .join(", ");

        writeln!(f, "\nSecurity Information:")?;
        writeln!(f, "=====================")?;
        writeln!(f, "Flags: {:#010x} ({:b})", self.flags, self.flags)?;
        writeln!(f, "Key Purposes: [{key_purposes}]")?;
        if let Some(chip_id) = self.chip_id {
            writeln!(f, "Chip ID: {chip_id}")?;
        }
        if let Some(api_version) = self.api_version {
            writeln!(f, "API Version: {api_version}")?;
        }
        if self.secure_boot_enabled() {
            writeln!(f, "Secure Boot: Enabled")?;
            if self.flag(1) {
                writeln!(f, "Secure Boot Aggressive key revocation: Enabled")?;
            }
            let revoked: Vec<String> = (0..3u32)
                .filter(|i| self.flag(3 + i))
                .map(|i| format!("Secure Boot Key{i} is Revoked"))
                .collect();
            if !revoked.is_empty() {
                writeln!(f, "Secure Boot Key Revocation Status:\n  {}", revoked.join("\n  "))?;
            }
        } else {
            writeln!(f, "Secure Boot: Disabled")?;
        }
        if self.flash_encryption_enabled() {
            writeln!(f, "Flash Encryption: Enabled")?;
        } else {
            writeln!(f, "Flash Encryption: Disabled")?;
        }
        writeln!(
            f,
            "SPI Boot Crypt Count (SPI_BOOT_CRYPT_CNT): 0x{:x}",
            self.flash_crypt_cnt
        )?;
        if self.flag(9) {
            writeln!(f, "Dcache in UART download mode: Disabled")?;
        }
        if self.flag(10) {
            writeln!(f, "Icache in UART download mode: Disabled")?;
        }
        if self.flag(7) {
            writeln!(f, "JTAG: Permanently Disabled")?;
        } else if self.flag(6) {
            writeln!(f, "JTAG: Software Access Disabled")?;
        }
        if self.flag(8) {
            writeln!(f, "USB Access: Disabled")?;
        }
        Ok(())
    }
}

/// 与目标设备的串口连接。
pub struct Connection {
    port: Port,
    port_name: String,
    usb_pid: u16,
    decoder: SlipDecoder,
    baud: u32,
    /// 响应尾部 status 字节数：ROM=4，stub=2。
    status_len: usize,
    /// 芯片是否处于 Secure Download Mode。
    pub(crate) secure_download_mode: bool,
}

/// 查询串口对应的 USB PID（用于识别 USB-Serial-JTAG）。
fn lookup_usb_pid(port_name: &str) -> u16 {
    if let Ok(ports) = serialport::available_ports() {
        for info in ports {
            if info.port_name.eq_ignore_ascii_case(port_name) {
                if let serialport::SerialPortType::UsbPort(usb) = info.port_type {
                    return usb.pid;
                }
            }
        }
    }
    0
}

impl Connection {
    /// 打开串口（固定以 115200 建立连接，之后可通过 CHANGE_BAUDRATE 提速）。
    pub fn open(port_name: &str) -> Result<Self> {
        let port = serialport::new(port_name, 115_200)
            .flow_control(serialport::FlowControl::None)
            .timeout(command::DEFAULT_TIMEOUT)
            .open_native()?;

        Ok(Connection {
            port,
            port_name: port_name.to_string(),
            usb_pid: lookup_usb_pid(port_name),
            decoder: SlipDecoder::new(),
            baud: 115_200,
            status_len: 4,
            secure_download_mode: false,
        })
    }

    pub fn port_name(&self) -> &str {
        &self.port_name
    }

    pub fn usb_pid(&self) -> u16 {
        self.usb_pid
    }

    pub fn is_usb_serial_jtag(&self) -> bool {
        self.usb_pid == USB_SERIAL_JTAG_PID
    }

    pub fn baud(&self) -> u32 {
        self.baud
    }

    /// stub 加载成功后调用：响应 status 字节数从 4 变为 2。
    pub(crate) fn set_stub_active(&mut self) {
        self.status_len = 2;
    }

    pub(crate) fn stub_active(&self) -> bool {
        self.status_len == 2
    }

    /// 复位进 bootloader 并完成 SYNC 同步。
    ///
    /// 依次循环尝试所有复位策略，直到同步成功。
    pub fn begin(&mut self, before: ResetBefore) -> Result<()> {
        if before == ResetBefore::NoResetNoSync {
            return Ok(());
        }

        let strategies = reset_strategy_sequence(self.usb_pid, before);
        let mut boot_log = String::new();

        for attempt in 0..MAX_CONNECT_ATTEMPTS {
            if before != ResetBefore::NoReset {
                let strategy = &strategies[attempt % strategies.len()];
                strategy.reset(&mut self.port)?;

                // 读取复位输出的 boot 日志（用于诊断没进下载模式的情况）
                if let Ok(available) = self.port.bytes_to_read() {
                    if available > 0 {
                        let mut buf = vec![0u8; available as usize];
                        if let Ok(n) = std::io::Read::read(&mut self.port, &mut buf) {
                            let text = String::from_utf8_lossy(&buf[..n]);
                            if let Some(idx) = text.find("boot:") {
                                boot_log = text[idx..].lines().next().unwrap_or("").to_string();
                            }
                        }
                    }
                }
            }

            for _ in 0..MAX_SYNC_ATTEMPTS {
                self.port.flush().ok();
                if self.sync().is_ok() {
                    self.set_timeout(command::DEFAULT_TIMEOUT)?;
                    return Ok(());
                }
            }
        }

        let detail = if boot_log.is_empty() {
            "no_sync_reply".to_string()
        } else {
            format!("wrong_boot_mode:{boot_log}")
        };
        Err(Error::ConnectionFailed(detail))
    }

    /// 发送 SYNC 帧并等待有效回复。
    fn sync(&mut self) -> Result<()> {
        self.set_timeout(command::SYNC_TIMEOUT)?;
        self.write_command_frame(Cmd::Sync, &command::sync_payload(), 0)?;

        sleep(Duration::from_millis(10));

        // ROM 会连发多条 SYNC 响应；读到第一条有效响应即认为同步成功，
        // 剩余响应在下一条命令写入前会被 clear input 清掉。
        let mut synced = false;
        for _ in 0..MAX_CONNECT_ATTEMPTS {
            match self.read_response(Cmd::Sync) {
                Ok(_) => {
                    synced = true;
                }
                Err(_) if synced => break,
                Err(e) => return Err(e),
            }
        }
        Ok(())
    }

    /// 设置串口读超时。
    pub fn set_timeout(&mut self, timeout: Duration) -> Result<()> {
        self.port.set_timeout(timeout)?;
        Ok(())
    }

    /// 修改本地串口波特率（协议层的 CHANGE_BAUDRATE 在 Flasher 中处理）。
    pub fn set_baud(&mut self, baud: u32) -> Result<()> {
        self.port.set_baud_rate(baud)?;
        self.baud = baud;
        Ok(())
    }

    /// 清空串口输入缓冲与解码器缓冲。
    pub fn clear_input(&mut self) -> Result<()> {
        self.port.clear(serialport::ClearBuffer::Input)?;
        self.decoder.clear();
        Ok(())
    }

    /// 写命令帧（写之前清空输入缓冲，避免残留响应干扰匹配）。
    fn write_command_frame(&mut self, cmd: Cmd, data: &[u8], checksum: u32) -> Result<()> {
        self.clear_input()?;
        let request = command::build_request(cmd, data, checksum);
        let frame = encode_frame(&request);
        self.port.write_all(&frame)?;
        self.port.flush()?;
        Ok(())
    }

    /// 读取一条与 `cmd` 匹配的响应并检查 status。
    fn read_response(&mut self, cmd: Cmd) -> Result<Response> {
        for _ in 0..100 {
            let frame = self.decoder.read_frame(&mut self.port)?;
            if frame.len() < 8 + self.status_len || frame[0] != 0x01 {
                continue;
            }
            if frame[1] != cmd as u8 {
                continue;
            }

            let value = u32::from_le_bytes(frame[4..8].try_into().unwrap());
            let status_start = frame.len() - self.status_len;
            let status = frame[status_start];
            let error_code = frame[status_start + 1];

            if status != 0 {
                return Err(Error::Rom {
                    command: cmd.name(),
                    code: error_code,
                });
            }

            return Ok(Response {
                value,
                data: frame[8..status_start].to_vec(),
            });
        }
        Err(Error::InvalidResponse(format!(
            "no_matching_response:{}",
            cmd.name()
        )))
    }

    /// 执行一条命令：设置超时 → 写请求 → 等响应。
    pub fn command(&mut self, cmd: Cmd, data: &[u8], checksum: u32) -> Result<Response> {
        self.command_with_timeout(cmd, data, checksum, cmd.timeout())
    }

    /// 同 [`Connection::command`]，但显式指定超时。
    pub fn command_with_timeout(
        &mut self,
        cmd: Cmd,
        data: &[u8],
        checksum: u32,
        timeout: Duration,
    ) -> Result<Response> {
        self.set_timeout(timeout)?;
        self.write_command_frame(cmd, data, checksum)?;
        let result = self.read_response(cmd);
        // 恢复默认超时，避免后续操作被撑长 / 缩短
        self.set_timeout(command::DEFAULT_TIMEOUT).ok();
        result.map_err(|e| match e {
            Error::Io(ref io) if io.kind() == std::io::ErrorKind::TimedOut => Error::Timeout {
                command: cmd.name(),
            },
            other => other,
        })
    }

    /// 读 32 位寄存器。
    pub fn read_reg(&mut self, addr: u32) -> Result<u32> {
        let resp = self.command(Cmd::ReadReg, &command::le32(&[addr]), 0)?;
        Ok(resp.value)
    }

    /// 写 32 位寄存器。
    pub fn write_reg(&mut self, addr: u32, value: u32, mask: Option<u32>) -> Result<()> {
        let data = command::le32(&[addr, value, mask.unwrap_or(0xFFFF_FFFF), 0]);
        self.command(Cmd::WriteReg, &data, 0)?;
        Ok(())
    }

    /// 读取一个原始 SLIP 帧（READ_FLASH 数据流使用）。
    pub fn read_raw_frame(&mut self, timeout: Duration) -> Result<Vec<u8>> {
        self.set_timeout(timeout)?;
        self.decoder.read_frame(&mut self.port)
    }

    /// 发送原始 SLIP 帧（READ_FLASH 的 ACK 使用；不清输入缓冲）。
    pub fn write_raw_frame(&mut self, payload: &[u8]) -> Result<()> {
        let frame = encode_frame(payload);
        self.port.write_all(&frame)?;
        self.port.flush()?;
        Ok(())
    }

    /// 读取固定字节数（stub "OHAI" 握手使用）。
    pub fn read_exact_frame_bytes(&mut self, len: usize, timeout: Duration) -> Result<Vec<u8>> {
        self.set_timeout(timeout)?;
        let frame = self.decoder.read_frame(&mut self.port)?;
        if frame.len() < len {
            return Err(Error::InvalidResponse(format!(
                "short_frame:{}:{}",
                len,
                frame.len()
            )));
        }
        Ok(frame)
    }

    /// 查询安全信息（ESP32 的 ROM 不支持该命令）。
    pub fn security_info(&mut self) -> Result<SecurityInfo> {
        let resp = self.command(Cmd::GetSecurityInfo, &[], 0)?;
        SecurityInfo::parse(&resp.data)
    }

    /// 读取芯片识别 magic 寄存器。
    pub fn read_chip_magic(&mut self) -> Result<u32> {
        self.read_reg(CHIP_DETECT_MAGIC_REG_ADDR)
    }

    /// 操作完成后的复位。
    pub fn reset_after(&mut self, after: ResetAfter) -> Result<()> {
        match after {
            ResetAfter::HardReset => hard_reset(&mut self.port, self.usb_pid),
            ResetAfter::NoReset => self.soft_reset_to_bootloader(),
            ResetAfter::NoResetNoStub => Ok(()),
        }
    }

    /// 软复位：stub 模式下回到 ROM bootloader；ROM 模式下本来就在 bootloader。
    fn soft_reset_to_bootloader(&mut self) -> Result<()> {
        if !self.stub_active() {
            return Ok(());
        }
        // stub 下发送 FLASH_BEGIN(空) + FLASH_END(reboot) 重新加载 ROM loader
        let begin = command::le32(&[0, 0, 0x400, 0]);
        self.command(Cmd::FlashBegin, &begin, 0)?;
        // FLASH_END data: 0 = reboot
        self.write_command_frame(Cmd::FlashEnd, &command::le32(&[0]), 0)?;
        Ok(())
    }
}
