//! # wheat-esptool
//!
//! 为 wheat-esp-tools 定制的 ESP 串口烧录协议库，功能移植自
//! [espressif/esptool](https://github.com/espressif/esptool)：
//!
//! - 复位进 bootloader、SYNC 同步、芯片自动识别（chip_id / magic 双途径）
//! - 官方 flasher stub 加载（压缩烧录、流式读取、整片擦除）
//! - 烧录（zlib 压缩 + 可选 MD5 校验）、READ_FLASH 流式读取（带 MD5 校验）
//! - 整片 / 区域擦除、设备信息（版本 / MAC / 晶振 / 特性 / Flash 容量 / 安全信息）
//! - 字节级进度事件（[`progress::ProgressSink`]），适配 UI 进度条与终端日志
//!
//! 快速上手、模块结构、**新增芯片的完整步骤**见 crate 根目录 `README.md`。

pub mod cancel;
pub mod chips;
pub mod command;
pub mod connection;
pub mod error;
pub mod flasher;
pub mod progress;
pub mod reset;
pub mod slip;
pub mod stub;

pub use cancel::CancelToken;
pub use chips::{ChipDefinition, CHIPS};
pub use connection::{Connection, SecurityInfo};
pub use error::{Error, Result};
pub use flasher::{
    flash_size_label, ConnectConfig, DeviceInfo, Flasher, Segment,
};
pub use progress::{NoProgress, ProgressEvent, ProgressSink};
pub use reset::{ResetAfter, ResetBefore};
