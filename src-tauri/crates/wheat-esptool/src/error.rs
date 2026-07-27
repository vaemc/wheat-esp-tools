//! 统一错误类型。
//!
//! 所有错误的 `Display` 输出都会被上层（Tauri 命令层）直接透传给前端，
//! 因此这里的文案保持机器可读的 `code:detail` 风格，前端按前缀映射 i18n。

use std::fmt;

/// wheat-esptool 的统一 Result。
pub type Result<T> = std::result::Result<T, Error>;

/// 库内所有可能出现的错误。
#[derive(Debug)]
pub enum Error {
    /// 底层 IO 错误（含串口读写超时）。
    Io(std::io::Error),
    /// serialport crate 的错误（打开串口 / 修改波特率等）。
    Serial(serialport::Error),
    /// 等待设备响应超时。`command` 是超时时正在执行的命令名。
    Timeout { command: &'static str },
    /// 多次复位 + 同步仍无法与芯片建立连接。
    ConnectionFailed(String),
    /// 芯片 ROM / stub 返回了错误状态码。
    Rom { command: &'static str, code: u8 },
    /// 响应帧格式不符合预期。
    InvalidResponse(String),
    /// 无法识别芯片（magic 值 / chip id 均未匹配）。
    ChipDetect(String),
    /// stub 加载后未收到 "OHAI" 握手。
    StubHandshake,
    /// SPI Flash 连接失败（尝试了所有 SPI 引脚组合）。
    FlashConnect,
    /// 读到的 flash size id 不在已知映射表内。
    UnsupportedFlashId(u8),
    /// 烧录后 MD5 校验不一致。
    VerifyFailed { addr: u32 },
    /// 读取 Flash 时 MD5 与设备端不一致（串口丢包）。
    DigestMismatch,
    /// 读取 Flash 时数据块长度异常（串口丢包）。
    CorruptData { expected: usize, got: usize },
    /// 设备返回的数据超过请求长度。
    ReadMoreThanExpected,
    /// 当前芯片 / 模式不支持该操作。
    Unsupported { what: &'static str },
    /// 操作被上层主动取消（见 `CancelToken`）。
    Cancelled,
}

impl Error {
    /// 判断该错误是否属于「串口不稳定，降速重试可能成功」一类。
    pub fn is_retryable_read(&self) -> bool {
        matches!(
            self,
            Error::DigestMismatch
                | Error::CorruptData { .. }
                | Error::Timeout { .. }
                | Error::Io(_)
        )
    }
}

/// ROM / stub 错误码 → 可读名称（见 esptool serial-protocol 文档）。
fn rom_error_name(code: u8) -> &'static str {
    match code {
        0x05 => "received_message_invalid",
        0x06 => "failed_to_act",
        0x07 => "invalid_crc",
        0x08 => "flash_write_error",
        0x09 => "flash_read_error",
        0x0A => "flash_read_length_error",
        0x0B => "deflate_error",
        // stub 专属错误码
        0xC0 => "bad_data_len",
        0xC1 => "bad_data_checksum",
        0xC2 => "bad_block_size",
        0xC3 => "invalid_command",
        0xC4 => "failed_spi_op",
        0xC5 => "failed_spi_unlock",
        0xC6 => "not_in_flash_mode",
        0xC7 => "inflate_error",
        0xC8 => "not_enough_data",
        0xC9 => "too_much_data",
        0xFF => "cmd_not_implemented",
        _ => "unknown",
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Io(e) => {
                if e.kind() == std::io::ErrorKind::TimedOut {
                    write!(f, "serial_timeout:{e}")
                } else {
                    write!(f, "io_error:{e}")
                }
            }
            Error::Serial(e) => write!(f, "serial_error:{e}"),
            Error::Timeout { command } => write!(f, "command_timeout:{command}"),
            Error::ConnectionFailed(detail) => write!(f, "connect_failed:{detail}"),
            Error::Rom { command, code } => {
                write!(f, "rom_error:{command}:0x{code:02X}:{}", rom_error_name(*code))
            }
            Error::InvalidResponse(detail) => write!(f, "invalid_response:{detail}"),
            Error::ChipDetect(detail) => write!(f, "chip_detect_failed:{detail}"),
            Error::StubHandshake => write!(f, "stub_handshake_failed"),
            Error::FlashConnect => write!(f, "flash_connect_failed"),
            Error::UnsupportedFlashId(id) => write!(f, "flash_size_unknown:0x{id:02X}"),
            Error::VerifyFailed { addr } => write!(f, "verify_failed:0x{addr:X}"),
            Error::DigestMismatch => write!(f, "read_corrupt:md5_mismatch"),
            Error::CorruptData { expected, got } => {
                write!(f, "read_corrupt:chunk:{expected}:{got}")
            }
            Error::ReadMoreThanExpected => write!(f, "read_corrupt:overflow"),
            Error::Unsupported { what } => write!(f, "unsupported:{what}"),
            Error::Cancelled => write!(f, "cancelled"),
        }
    }
}

impl std::error::Error for Error {}

impl From<std::io::Error> for Error {
    fn from(e: std::io::Error) -> Self {
        Error::Io(e)
    }
}

impl From<serialport::Error> for Error {
    fn from(e: serialport::Error) -> Self {
        Error::Serial(e)
    }
}
