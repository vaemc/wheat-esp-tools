use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlashItem {
    /// 烧录偏移，支持 `0x10000` / `65536`
    pub offset: String,
    /// 本地 bin 绝对路径
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteFlashArgs {
    pub port: String,
    pub baud: u32,
    pub items: Vec<FlashItem>,
    /// `keep` | `qio` | `qout` | `dio` | `dout`
    #[serde(default = "default_flash_mode")]
    pub flash_mode: String,
    #[serde(default)]
    pub erase_all: bool,
    #[serde(default = "default_before")]
    pub before: String,
    #[serde(default = "default_after")]
    pub after: String,
    pub job_id: String,
}

fn default_flash_mode() -> String {
    "dio".into()
}

fn default_before() -> String {
    "default-reset".into()
}

fn default_after() -> String {
    "hard-reset".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadFlashArgs {
    pub port: String,
    pub baud: u32,
    pub offset: String,
    /// 字节数，或 `"ALL"` / `"all"` 表示整片
    pub size: String,
    pub save_path: String,
    #[serde(default = "default_before")]
    pub before: String,
    #[serde(default = "default_after")]
    pub after: String,
    pub job_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EraseFlashArgs {
    pub port: String,
    pub baud: u32,
    #[serde(default = "default_before")]
    pub before: String,
    #[serde(default = "default_after")]
    pub after: String,
    pub job_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EraseRegionArgs {
    pub port: String,
    pub baud: u32,
    pub offset: String,
    pub size: String,
    #[serde(default = "default_before")]
    pub before: String,
    #[serde(default = "default_after")]
    pub after: String,
    pub job_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfoArgs {
    pub port: String,
    #[serde(default = "default_info_baud")]
    pub baud: u32,
    #[serde(default = "default_before")]
    pub before: String,
    #[serde(default = "default_after")]
    pub after: String,
    pub job_id: String,
}

fn default_info_baud() -> u32 {
    115_200
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeBinArgs {
    pub output_path: String,
    pub items: Vec<FlashItem>,
    /// 保留参数（与旧 UI 兼容）；合并本身不依赖芯片型号
    #[serde(default)]
    pub chip: String,
    pub job_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EspDeviceInfoDto {
    pub chip_type: String,
    pub chip_detail: String,
    pub revision: String,
    pub mac: String,
    pub crystal: String,
    pub features: String,
    pub flash_size: String,
    pub flash_type: String,
    pub flash_manufacturer: String,
    pub flash_device: String,
    pub psram: String,
    pub security: String,
}

pub type MsgParams = HashMap<String, String>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EspflashProgressEvent {
    pub job_id: String,
    pub op: String,
    pub phase: String,
    pub percent: f64,
    /// 前端 i18n key：`espflash.msg.{messageKey}`
    pub message_key: String,
    pub params: MsgParams,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub addr: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EspflashLogEvent {
    pub job_id: String,
    pub message_key: String,
    pub params: MsgParams,
}

pub fn p(pairs: &[(&str, String)]) -> MsgParams {
    pairs
        .iter()
        .map(|(k, v)| ((*k).to_string(), v.clone()))
        .collect()
}

pub fn hex_addr(addr: u32) -> String {
    format!("0x{addr:X}")
}
