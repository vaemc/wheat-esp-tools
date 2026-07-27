//! Flasher stub 加载器资源。
//!
//! stub 是 Espressif 官方提供的运行在芯片 RAM 中的小程序
//! （<https://github.com/espressif/esp-flasher-stub>，esptool 同源），
//! 提供 ROM bootloader 不具备 / 更快的功能：压缩写入、READ_FLASH 流式读取、
//! 整片擦除等。TOML 内容为 base64 编码的 text/data 段 + 入口地址。
//!
//! 新增芯片时：把官方发布的 `<chip>.toml` 放进 `stubs/` 目录，
//! 并在对应芯片定义的 `stub()` 中 `include_str!` 引用（见 README）。

use base64::Engine;
use serde::Deserialize;

use crate::error::{Error, Result};

/// 已解析的 stub 镜像。
#[derive(Debug, Clone)]
pub struct StubImage {
    /// 入口地址。
    pub entry: u32,
    /// text 段加载地址。
    pub text_start: u32,
    /// text 段内容。
    pub text: Vec<u8>,
    /// data 段加载地址。
    pub data_start: u32,
    /// data 段内容。
    pub data: Vec<u8>,
}

#[derive(Deserialize)]
struct StubToml {
    entry: u32,
    text: String,
    text_start: u32,
    data: String,
    data_start: u32,
}

/// 解析 stub TOML（编译期通过 `include_str!` 内嵌）。
pub fn parse_stub_toml(source: &str) -> Result<StubImage> {
    let raw: StubToml = toml::from_str(source)
        .map_err(|e| Error::InvalidResponse(format!("bad_stub_toml:{e}")))?;
    let engine = base64::engine::general_purpose::STANDARD;
    let text = engine
        .decode(&raw.text)
        .map_err(|e| Error::InvalidResponse(format!("bad_stub_text:{e}")))?;
    let data = engine
        .decode(&raw.data)
        .map_err(|e| Error::InvalidResponse(format!("bad_stub_data:{e}")))?;
    Ok(StubImage {
        entry: raw.entry,
        text_start: raw.text_start,
        text,
        data_start: raw.data_start,
        data,
    })
}
