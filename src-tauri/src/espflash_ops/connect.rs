use espflash::{
    connection::{Connection, ResetAfterOperation, ResetBeforeOperation},
    flasher::{FlashMode, Flasher},
    Error,
};
use serialport::{FlowControl, SerialPortType, UsbPortInfo};

use super::progress::ProgressEmitter;
use super::types::p;

pub fn parse_u32(raw: &str) -> Result<u32, String> {
    let s = raw.trim();
    if s.is_empty() {
        return Err("empty_offset_or_size".into());
    }
    if let Some(hex) = s
        .strip_prefix("0x")
        .or_else(|| s.strip_prefix("0X"))
    {
        return u32::from_str_radix(hex, 16).map_err(|e| format!("invalid_hex:{s}:{e}"));
    }

    // 支持 esptool 常见后缀：64K / 1M / 512KB / 2MB（十进制基数）
    let upper = s.to_ascii_uppercase();
    let (num_part, mult) = if let Some(n) = upper.strip_suffix("MB") {
        (n, 1024u64 * 1024)
    } else if let Some(n) = upper.strip_suffix('M') {
        (n, 1024u64 * 1024)
    } else if let Some(n) = upper.strip_suffix("KB") {
        (n, 1024u64)
    } else if let Some(n) = upper.strip_suffix('K') {
        (n, 1024u64)
    } else {
        (upper.as_str(), 1u64)
    };

    let base = num_part
        .parse::<u64>()
        .map_err(|e| format!("invalid_int:{s}:{e}"))?;
    let value = base
        .checked_mul(mult)
        .ok_or_else(|| format!("size_overflow:{s}"))?;
    u32::try_from(value).map_err(|_| format!("size_overflow:{s}"))
}

pub fn parse_before(raw: &str) -> ResetBeforeOperation {
    let key = raw.trim().to_ascii_lowercase().replace('_', "-");
    match key.as_str() {
        "default-reset" | "defaultreset" => ResetBeforeOperation::DefaultReset,
        "no-reset" | "noreset" => ResetBeforeOperation::NoReset,
        "no-reset-no-sync" | "noresetnosync" => ResetBeforeOperation::NoResetNoSync,
        "usb-reset" | "usbreset" => ResetBeforeOperation::UsbReset,
        _ => ResetBeforeOperation::DefaultReset,
    }
}

pub fn parse_after(raw: &str) -> ResetAfterOperation {
    let key = raw.trim().to_ascii_lowercase().replace('_', "-");
    match key.as_str() {
        "hard-reset" | "hardreset" => ResetAfterOperation::HardReset,
        "no-reset" | "noreset" => ResetAfterOperation::NoReset,
        "no-reset-no-stub" | "noresetnostub" => ResetAfterOperation::NoResetNoStub,
        "watchdog-reset" | "watchdogreset" => ResetAfterOperation::WatchdogReset,
        _ => ResetAfterOperation::HardReset,
    }
}

pub fn parse_flash_mode(raw: &str) -> Option<FlashMode> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "keep" | "" => None,
        "qio" => Some(FlashMode::Qio),
        "qout" => Some(FlashMode::Qout),
        "dio" => Some(FlashMode::Dio),
        "dout" => Some(FlashMode::Dout),
        _ => Some(FlashMode::Dio),
    }
}

/// 若 bin 是 ESP 镜像（magic 0xE9），按 esptool 规则写入 flash_mode 字节。
pub fn patch_flash_mode(data: &mut [u8], mode: FlashMode) {
    if data.first() != Some(&0xE9) || data.len() < 3 {
        return;
    }
    data[2] = match mode {
        FlashMode::Qio => 0,
        FlashMode::Qout => 1,
        FlashMode::Dio => 2,
        FlashMode::Dout => 3,
        _ => 2,
    };
}

fn resolve_usb_port_info(port_name: &str) -> UsbPortInfo {
    if let Ok(ports) = serialport::available_ports() {
        for info in ports {
            if info.port_name == port_name {
                match info.port_type {
                    SerialPortType::UsbPort(usb) => return usb,
                    SerialPortType::PciPort | SerialPortType::Unknown => {
                        return UsbPortInfo {
                            vid: 0,
                            pid: 0,
                            serial_number: None,
                            manufacturer: None,
                            product: None,
                        };
                    }
                    _ => {}
                }
            }
        }
    }
    UsbPortInfo {
        vid: 0,
        pid: 0,
        serial_number: None,
        manufacturer: None,
        product: None,
    }
}

pub fn connect_flasher(
    port_name: &str,
    baud: u32,
    before: ResetBeforeOperation,
    after: ResetAfterOperation,
    emitter: &ProgressEmitter,
) -> Result<Flasher, String> {
    emitter.phase_params(
        "connecting",
        2.0,
        "openPort",
        p(&[("port", port_name.to_string())]),
    );

    let serial = serialport::new(port_name, 115_200)
        .flow_control(FlowControl::None)
        .open_native()
        .map_err(|e| format!("open_port_failed:{port_name}:{e}"))?;

    let usb_info = resolve_usb_port_info(port_name);
    let connection = Connection::new(*Box::new(serial), usb_info, after, before, baud);

    emitter.phase("connecting", 8.0, "connectingStub");

    Flasher::connect(
        connection,
        true,  // use_stub
        true,  // verify
        true,  // skip identical
        None,  // auto-detect chip
        Some(baud.max(115_200)),
    )
    .map_err(map_espflash_error)
}

pub fn finish_with_reset(flasher: &mut Flasher) -> Result<(), String> {
    let chip = flasher.chip();
    flasher
        .connection()
        .reset_after(true, chip)
        .map_err(map_espflash_error)
}

pub fn map_espflash_error(err: Error) -> String {
    match &err {
        Error::CorruptData(expected, got) => {
            format!("read_corrupt:{expected:x}:{got:x}")
        }
        _ => {
            let msg = err.to_string();
            if msg.trim().is_empty() {
                format!("{err:?}")
            } else {
                msg
            }
        }
    }
}

/// 读 Flash 用的波特率阶梯：先试请求值（上限 460800），失败再降速。
pub fn read_baud_candidates(requested: u32) -> Vec<u32> {
    let start = requested.min(460_800).max(115_200);
    let mut out = vec![start];
    for b in [230_400u32, 115_200] {
        if b < start && !out.contains(&b) {
            out.push(b);
        }
    }
    out
}

pub fn is_retryable_read_error(err: &str) -> bool {
    err.starts_with("read_corrupt:")
        || err.contains("Corrupt data")
        || err.contains("IncorrectResponse")
        || err.contains("timeout")
        || err.contains("Timeout")
        || err.contains("TimedOut")
}

pub fn format_flash_size(size: espflash::flasher::FlashSize) -> String {
    let bytes = size.size() as u64;
    if bytes >= 1024 * 1024 {
        format!("{}MB", bytes / (1024 * 1024))
    } else if bytes >= 1024 {
        format!("{}KB", bytes / 1024)
    } else {
        format!("{bytes}B")
    }
}
