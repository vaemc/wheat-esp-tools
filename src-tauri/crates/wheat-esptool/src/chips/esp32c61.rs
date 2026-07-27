//! ESP32-C61 芯片定义（继承自 ESP32-C6 架构，eFuse 基址不同）。
//!
//! 对照 esptool `targets/esp32c61.py`。

use super::{read_efuse, ChipDefinition, EfuseField, SpiRegisters, SPI_REGS_V2_0X60003000};
use crate::connection::Connection;
use crate::error::Result;

pub struct Esp32c61;

/// EFUSE_BASE = 0x600B4800；block0 读地址 +0x030，block1 +0x044。
const EFUSE_BLOCKS: &[u32] = &[0x600B_4830, 0x600B_4844];

const MAC0: EfuseField = EfuseField::new(1, 0, 32);
const MAC1: EfuseField = EfuseField::new(1, 32, 16);
// block1 word2：minor = bit0..3，major = bit4..5
const WAFER_VERSION_MINOR: EfuseField = EfuseField::new(1, 64, 4);
const WAFER_VERSION_MAJOR: EfuseField = EfuseField::new(1, 68, 2);

impl ChipDefinition for Esp32c61 {
    fn name(&self) -> &'static str {
        "ESP32-C61"
    }

    fn chip_id(&self) -> Option<u16> {
        Some(20)
    }

    /// 无独立 magic（与 C6 同 ROM 系），只经 GET_SECURITY_INFO chip_id 识别。
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

    fn stub_source(&self, _revision: Option<(u32, u32)>) -> Option<&'static str> {
        Some(include_str!("../../stubs/esp32c61.toml"))
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
            "BT 5 (LE)".into(),
            "Single Core".into(),
            "160MHz".into(),
        ])
    }
}
