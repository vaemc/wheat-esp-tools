//! ESP32-C6 芯片定义。

use super::{
    read_efuse, ChipDefinition, EfuseField, SpiRegisters, SPI_REGS_V2_0X60003000,
};
use crate::connection::Connection;
use crate::error::Result;

pub struct Esp32c6;

const EFUSE_BLOCKS: &[u32] = &[0x600B_082C, 0x600B_0844, 0x600B_085C, 0x600B_087C];

const MAC0: EfuseField = EfuseField::new(1, 0, 32);
const MAC1: EfuseField = EfuseField::new(1, 32, 16);
const WAFER_VERSION_MAJOR: EfuseField = EfuseField::new(1, 118, 2);
const WAFER_VERSION_MINOR: EfuseField = EfuseField::new(1, 114, 4);

impl ChipDefinition for Esp32c6 {
    fn name(&self) -> &'static str {
        "ESP32-C6"
    }

    fn chip_id(&self) -> Option<u16> {
        Some(13)
    }

    fn magic_values(&self) -> &'static [u32] {
        &[0x2CE0_806F]
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
        Some(include_str!("../../stubs/esp32c6.toml"))
    }

    fn revision(&self, conn: &mut Connection) -> Result<(u32, u32)> {
        Ok((
            read_efuse(conn, self, WAFER_VERSION_MAJOR)?,
            read_efuse(conn, self, WAFER_VERSION_MINOR)?,
        ))
    }

    fn features(&self, _conn: &mut Connection) -> Result<Vec<String>> {
        Ok(vec!["WiFi 6".into(), "BT 5".into()])
    }
}
