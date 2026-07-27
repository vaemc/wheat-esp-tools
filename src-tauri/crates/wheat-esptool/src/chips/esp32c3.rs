//! ESP32-C3 (ESP8685) 芯片定义。

use super::{
    read_efuse, ChipDefinition, EfuseField, SpiRegisters, SPI_REGS_V2_0X60002000,
};
use crate::connection::Connection;
use crate::error::Result;

pub struct Esp32c3;

const EFUSE_BLOCKS: &[u32] = &[0x6000_882C, 0x6000_8844, 0x6000_885C, 0x6000_887C];

const MAC0: EfuseField = EfuseField::new(1, 0, 32);
const MAC1: EfuseField = EfuseField::new(1, 32, 16);
const WAFER_VERSION_MAJOR: EfuseField = EfuseField::new(1, 184, 2);
const WAFER_VERSION_MINOR_HI: EfuseField = EfuseField::new(1, 183, 1);
const WAFER_VERSION_MINOR_LO: EfuseField = EfuseField::new(1, 114, 3);

impl ChipDefinition for Esp32c3 {
    fn name(&self) -> &'static str {
        "ESP32-C3"
    }

    fn chip_id(&self) -> Option<u16> {
        Some(5)
    }

    fn magic_values(&self) -> &'static [u32] {
        &[
            0x6921_506F, // ECO1 + ECO2
            0x1B31_506F, // ECO3
            0x4881_606F, // ECO6
            0x4361_606F, // ECO7
        ]
    }

    fn efuse_block_read_addrs(&self) -> &'static [u32] {
        EFUSE_BLOCKS
    }

    fn mac_fields(&self) -> (EfuseField, EfuseField) {
        (MAC0, MAC1)
    }

    fn spi_registers(&self) -> SpiRegisters {
        SPI_REGS_V2_0X60002000
    }

    fn stub_source(&self, _revision: Option<(u32, u32)>) -> Option<&'static str> {
        Some(include_str!("../../stubs/esp32c3.toml"))
    }

    fn revision(&self, conn: &mut Connection) -> Result<(u32, u32)> {
        let major = read_efuse(conn, self, WAFER_VERSION_MAJOR)?;
        let hi = read_efuse(conn, self, WAFER_VERSION_MINOR_HI)?;
        let lo = read_efuse(conn, self, WAFER_VERSION_MINOR_LO)?;
        Ok((major, (hi << 3) + lo))
    }

    fn features(&self, _conn: &mut Connection) -> Result<Vec<String>> {
        Ok(vec!["WiFi".into(), "BLE".into()])
    }
}
