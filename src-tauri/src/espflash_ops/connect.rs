//! 参数解析与 wheat-esptool 连接封装。

use wheat_esptool::{ConnectConfig, Error as EspError, Flasher, ResetAfter, ResetBefore};

use super::progress::OpsSink;

pub fn parse_u32(raw: &str) -> Result<u32, String> {
    let s = raw.trim();
    if s.is_empty() {
        return Err("empty_offset_or_size".into());
    }
    if let Some(hex) = s.strip_prefix("0x").or_else(|| s.strip_prefix("0X")) {
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

pub fn parse_before(raw: &str) -> ResetBefore {
    let key = raw.trim().to_ascii_lowercase().replace('_', "-");
    match key.as_str() {
        "no-reset" | "noreset" => ResetBefore::NoReset,
        "no-reset-no-sync" | "noresetnosync" => ResetBefore::NoResetNoSync,
        "usb-reset" | "usbreset" => ResetBefore::UsbReset,
        _ => ResetBefore::DefaultReset,
    }
}

pub fn parse_after(raw: &str) -> ResetAfter {
    let key = raw.trim().to_ascii_lowercase().replace('_', "-");
    match key.as_str() {
        "no-reset" | "noreset" => ResetAfter::NoReset,
        "no-reset-no-stub" | "noresetnostub" => ResetAfter::NoResetNoStub,
        // watchdog-reset 未实现专用时序，回落到硬复位
        _ => ResetAfter::HardReset,
    }
}

/// flash mode 字符串 → 镜像头字节值（qio=0 / qout=1 / dio=2 / dout=3）。
pub fn parse_flash_mode(raw: &str) -> Result<u8, String> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "qio" => Ok(0),
        "qout" => Ok(1),
        // 空串走默认；keep 为旧 UI 兼容，等同 dio
        "dio" | "" | "keep" => Ok(2),
        "dout" => Ok(3),
        other => Err(format!("invalid_flash_mode:{other}")),
    }
}

/// 若 bin 是 ESP 镜像（magic 0xE9），改写头部第 3 字节的 flash_mode。
pub fn patch_flash_mode(data: &mut [u8], mode: u8) {
    if data.first() != Some(&0xE9) || data.len() < 3 {
        return;
    }
    data[2] = mode;
}

/// 连接设备；错误统一转为前端可解析的字符串码。
pub fn connect_flasher(
    port_name: &str,
    baud: u32,
    before: ResetBefore,
    after: ResetAfter,
    sink: &mut OpsSink<'_>,
) -> Result<Flasher, String> {
    let cfg = ConnectConfig {
        port: port_name.to_string(),
        baud,
        before,
        after,
        use_stub: true, // 固定启用 stub：压缩烧录 / 流式读取 / 整片擦除都依赖它
    };
    Flasher::connect(&cfg, sink).map_err(|e| match e {
        EspError::Serial(se) => format!("open_port_failed:{port_name}:{se}"),
        other => other.to_string(),
    })
}

pub fn map_esp_error(err: EspError) -> String {
    err.to_string()
}

/// 读 Flash 用的波特率阶梯：先试请求值（上限 460800），失败再降速。
pub fn read_baud_candidates(requested: u32) -> Vec<u32> {
    let start = requested.clamp(115_200, 460_800);
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
        || err.contains("timeout")
        || err.contains("Timeout")
        || err.contains("TimedOut")
        || err.starts_with("io_error:")
}
