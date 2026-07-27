//! ESP32-H21 芯片定义（继承自 ESP32-H2 架构，eFuse 基址不同）。
//!
//! 对照 esptool `targets/esp32h21.py`。
//! 注意：esptool 目前未提供 H21 的 flasher stub，本芯片以 ROM loader 运行
//! （写入/擦除可用但较慢；READ_FLASH 流式读取不可用）。

use super::{read_efuse, ChipDefinition, EfuseField, SpiRegisters, SPI_REGS_V2_0X60003000};
use crate::connection::Connection;
use crate::error::Result;

pub struct Esp32h21;

/// EFUSE_BASE = 0x600B4000；block0 读地址 +0x030，block1 +0x044。
const EFUSE_BLOCKS: &[u32] = &[0x600B_4030, 0x600B_4044];

const MAC0: EfuseField = EfuseField::new(1, 0, 32);
const MAC1: EfuseField = EfuseField::new(1, 32, 16);
// block1 word5：minor = bit4..7，major = bit8..9
const WAFER_VERSION_MINOR: EfuseField = EfuseField::new(1, 164, 4);
const WAFER_VERSION_MAJOR: EfuseField = EfuseField::new(1, 168, 2);

impl ChipDefinition for Esp32h21 {
    fn name(&self) -> &'static str {
        "ESP32-H21"
    }

    fn chip_id(&self) -> Option<u16> {
        Some(25)
    }

    fn magic_values(&self) -> &'static [u32] {
        &[]
    }

    fn efuse_block_read_addrs(&self) -> &'static [u32] {
        EFUSE_BLOCKS
    }

    fn mac_fields(&self) -> (EfuseField, EfuseField) {
        (MAC0, MAC1)
    }

    fn spi_registers(&self) -> SpiRegisters {
        SPI_REGS_V2_0X60003000
    }

    /// esptool 尚未发布 H21 stub，回落 ROM loader。
    fn stub_source(&self, _revision: Option<(u32, u32)>) -> Option<&'static str> {
        None
    }

    fn revision(&self, conn: &mut Connection) -> Result<(u32, u32)> {
        Ok((
            read_efuse(conn, self, WAFER_VERSION_MAJOR)?,
            read_efuse(conn, self, WAFER_VERSION_MINOR)?,
        ))
    }

    fn xtal_mhz(&self, _conn: &mut Connection) -> Result<u32> {
        Ok(32)
    }

    fn features(&self, _conn: &mut Connection) -> Result<Vec<String>> {
        Ok(vec![
            "BT 5 (LE)".into(),
            "IEEE802.15.4".into(),
            "Single Core".into(),
            "96MHz".into(),
        ])
    }
}
