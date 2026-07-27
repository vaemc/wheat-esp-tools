//! esptool 串口协议命令码、超时策略与请求包构造。
//!
//! 参考: <https://docs.espressif.com/projects/esptool/en/latest/esp32/advanced-topics/serial-protocol.html#commands>
//!
//! 请求包布局（SLIP 帧内）:
//! `<direction:u8=0x00> <command:u8> <size:u16 LE> <checksum:u32 LE> <data...>`
//!
//! checksum 仅对携带数据体的命令（FLASH_DATA / MEM_DATA / FLASH_DEFL_DATA）
//! 有效：以 0xEF 为种子对数据体逐字节 XOR。

use std::time::Duration;

pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(3);
pub const SYNC_TIMEOUT: Duration = Duration::from_millis(100);
pub const MEM_END_TIMEOUT: Duration = Duration::from_millis(500);
pub const ERASE_CHIP_TIMEOUT: Duration = Duration::from_secs(120);
pub const FLASH_DEFL_END_TIMEOUT: Duration = Duration::from_secs(10);

const ERASE_REGION_TIMEOUT_PER_MB: f64 = 30.0; // 秒
const WRITE_TIMEOUT_PER_MB: f64 = 40.0; // 秒
const MD5_TIMEOUT_PER_MB: f64 = 8.0; // 秒

/// 命令码（与 esptool 保持一致）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum Cmd {
    // ROM bootloader 与 stub 都支持
    FlashBegin = 0x02,
    FlashData = 0x03,
    FlashEnd = 0x04,
    MemBegin = 0x05,
    MemEnd = 0x06,
    MemData = 0x07,
    Sync = 0x08,
    WriteReg = 0x09,
    ReadReg = 0x0A,
    // ESP32 及以后芯片的 ROM bootloader 支持
    SpiSetParams = 0x0B,
    SpiAttach = 0x0D,
    ChangeBaudrate = 0x0F,
    FlashDeflBegin = 0x10,
    FlashDeflData = 0x11,
    FlashDeflEnd = 0x12,
    FlashMd5 = 0x13,
    GetSecurityInfo = 0x14,
    // 仅 stub 支持
    EraseFlash = 0xD0,
    EraseRegion = 0xD1,
    ReadFlash = 0xD2,
    RunUserCode = 0xD3,
}

impl Cmd {
    pub fn name(self) -> &'static str {
        match self {
            Cmd::FlashBegin => "FLASH_BEGIN",
            Cmd::FlashData => "FLASH_DATA",
            Cmd::FlashEnd => "FLASH_END",
            Cmd::MemBegin => "MEM_BEGIN",
            Cmd::MemEnd => "MEM_END",
            Cmd::MemData => "MEM_DATA",
            Cmd::Sync => "SYNC",
            Cmd::WriteReg => "WRITE_REG",
            Cmd::ReadReg => "READ_REG",
            Cmd::SpiSetParams => "SPI_SET_PARAMS",
            Cmd::SpiAttach => "SPI_ATTACH",
            Cmd::ChangeBaudrate => "CHANGE_BAUDRATE",
            Cmd::FlashDeflBegin => "FLASH_DEFL_BEGIN",
            Cmd::FlashDeflData => "FLASH_DEFL_DATA",
            Cmd::FlashDeflEnd => "FLASH_DEFL_END",
            Cmd::FlashMd5 => "FLASH_MD5",
            Cmd::GetSecurityInfo => "GET_SECURITY_INFO",
            Cmd::EraseFlash => "ERASE_FLASH",
            Cmd::EraseRegion => "ERASE_REGION",
            Cmd::ReadFlash => "READ_FLASH",
            Cmd::RunUserCode => "RUN_USER_CODE",
        }
    }

    /// 命令的默认超时。
    pub fn timeout(self) -> Duration {
        match self {
            Cmd::Sync => SYNC_TIMEOUT,
            Cmd::MemEnd => MEM_END_TIMEOUT,
            Cmd::EraseFlash => ERASE_CHIP_TIMEOUT,
            Cmd::FlashDeflEnd => FLASH_DEFL_END_TIMEOUT,
            _ => DEFAULT_TIMEOUT,
        }
    }

    /// 按数据量缩放的超时（擦除 / 写入 / MD5 随区域增大而变长）。
    pub fn timeout_for_size(self, size: u32) -> Duration {
        fn scaled(per_mb: f64, size: u32) -> Duration {
            let mb = size as f64 / 1_000_000.0;
            let secs = (per_mb * mb).max(FLASH_DEFL_END_TIMEOUT.as_secs_f64());
            Duration::from_secs_f64(secs)
        }
        match self {
            Cmd::FlashBegin | Cmd::FlashDeflBegin | Cmd::EraseRegion => {
                scaled(ERASE_REGION_TIMEOUT_PER_MB, size)
            }
            Cmd::FlashData | Cmd::FlashDeflData => scaled(WRITE_TIMEOUT_PER_MB, size),
            Cmd::FlashMd5 => scaled(MD5_TIMEOUT_PER_MB, size),
            _ => self.timeout(),
        }
    }
}

/// SYNC 命令的数据体：`0x07 0x07 0x12 0x20` + 32 × `0x55`。
pub fn sync_payload() -> Vec<u8> {
    let mut data = vec![0x07, 0x07, 0x12, 0x20];
    data.extend(std::iter::repeat_n(0x55, 32));
    data
}

/// 数据体校验和（XOR，种子 0xEF）。
pub fn checksum(data: &[u8]) -> u32 {
    let mut c: u8 = 0xEF;
    for b in data {
        c ^= *b;
    }
    c as u32
}

/// 构造完整请求包（不含 SLIP 封装）。
pub fn build_request(cmd: Cmd, data: &[u8], checksum: u32) -> Vec<u8> {
    let mut out = Vec::with_capacity(8 + data.len());
    out.push(0x00); // direction: request
    out.push(cmd as u8);
    out.extend_from_slice(&(data.len() as u16).to_le_bytes());
    out.extend_from_slice(&checksum.to_le_bytes());
    out.extend_from_slice(data);
    out
}

/// 小工具：按小端序拼接 u32 参数列表。
pub fn le32(words: &[u32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(words.len() * 4);
    for w in words {
        out.extend_from_slice(&w.to_le_bytes());
    }
    out
}

/// 数据类命令（FLASH_DATA / FLASH_DEFL_DATA / MEM_DATA）的数据体：
/// `<size:u32> <seq:u32> <0:u32> <0:u32> <payload...>`，可选补齐。
pub fn data_payload(block: &[u8], pad_to: usize, pad_byte: u8, sequence: u32) -> (Vec<u8>, u32) {
    let pad_len = pad_to.saturating_sub(block.len());
    let total = block.len() + pad_len;

    let mut data = Vec::with_capacity(16 + total);
    data.extend_from_slice(&(total as u32).to_le_bytes());
    data.extend_from_slice(&sequence.to_le_bytes());
    data.extend_from_slice(&0u32.to_le_bytes());
    data.extend_from_slice(&0u32.to_le_bytes());
    data.extend_from_slice(block);
    data.extend(std::iter::repeat_n(pad_byte, pad_len));

    // checksum 只覆盖数据体（含补齐字节），不含 16 字节头
    let check = checksum(&data[16..]);
    (data, check)
}
