//! ESP32-H4 芯片定义。
//!
//! 对照 esptool `targets/esp32h4.py`。

use super::{read_efuse, spi_regs_v2_at, ChipDefinition, EfuseField, SpiRegisters};
use crate::connection::Connection;
use crate::error::Result;

pub struct Esp32h4;

/// EFUSE_BASE = 0x600B1800；block0 读地址 +0x030，block1 +0x044。
const EFUSE_BLOCKS: &[u32] = &[0x600B_1830, 0x600B_1844];

const MAC0: EfuseField = EfuseField::new(1, 0, 32);
const MAC1: EfuseField = EfuseField::new(1, 32, 16);
// block1 word3：minor = bit18..21，major = bit22..23
const WAFER_VERSION_MINOR: EfuseField = EfuseField::new(1, 114, 4);
const WAFER_VERSION_MAJOR: EfuseField = EfuseField::new(1, 118, 2);

impl ChipDefinition for Esp32h4 {
    fn name(&self) -> &'static str {
        "ESP32-H4"
    }

    fn chip_id(&self) -> Option<u16> {
        Some(28)
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
        spi_regs_v2_at(0x6009_9000)
    }

    fn stub_source(&self, _revision: Option<(u32, u32)>) -> Option<&'static str> {
        Some(include_str!("../../stubs/esp32h4.toml"))
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
            "Dual Core".into(),
            "96MHz".into(),
        ])
    }
}
