//! ESP32-S31 芯片定义（继承自 ESP32-C5 架构，地址空间完全不同）。
//!
//! 对照 esptool `targets/esp32s31.py`。

use super::{read_efuse, spi_regs_v2_at, ChipDefinition, EfuseField, SpiRegisters};
use crate::connection::Connection;
use crate::error::Result;

pub struct Esp32s31;

/// EFUSE_BASE = 0x20715000；block0 读地址 +0x030，block1 +0x050（注意与其他芯片不同）。
const EFUSE_BLOCKS: &[u32] = &[0x2071_5030, 0x2071_5050];

const MAC0: EfuseField = EfuseField::new(1, 0, 32);
const MAC1: EfuseField = EfuseField::new(1, 32, 16);
// block1 word3：minor = bit18..21，major = bit22..23
const WAFER_VERSION_MINOR: EfuseField = EfuseField::new(1, 114, 4);
const WAFER_VERSION_MAJOR: EfuseField = EfuseField::new(1, 118, 2);

impl ChipDefinition for Esp32s31 {
    fn name(&self) -> &'static str {
        "ESP32-S31"
    }

    fn chip_id(&self) -> Option<u16> {
        Some(32)
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
        spi_regs_v2_at(0x2050_1000)
    }

    fn stub_source(&self, _revision: Option<(u32, u32)>) -> Option<&'static str> {
        Some(include_str!("../../stubs/esp32s31.toml"))
    }

    fn revision(&self, conn: &mut Connection) -> Result<(u32, u32)> {
        Ok((
            read_efuse(conn, self, WAFER_VERSION_MAJOR)?,
            read_efuse(conn, self, WAFER_VERSION_MINOR)?,
        ))
    }

    fn features(&self, _conn: &mut Connection) -> Result<Vec<String>> {
        Ok(vec![
            "WiFi 6".into(),
            "BT 5.4 (LE)".into(),
            "IEEE802.15.4".into(),
            "Dual Core + LP Core".into(),
            "300MHz".into(),
        ])
    }
}
