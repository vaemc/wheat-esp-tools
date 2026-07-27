//! ESP32-C2 (ESP8684) 芯片定义。

use super::{
    read_efuse, ChipDefinition, EfuseField, SpiRegisters, SPI_REGS_V2_0X60002000,
};
use crate::connection::Connection;
use crate::error::Result;

pub struct Esp32c2;

const EFUSE_BLOCKS: &[u32] = &[0x6000_882C, 0x6000_8834, 0x6000_8840, 0x6000_8860];

const MAC0: EfuseField = EfuseField::new(2, 0, 32);
const MAC1: EfuseField = EfuseField::new(2, 32, 16);
const WAFER_VERSION_MAJOR: EfuseField = EfuseField::new(2, 52, 2);
const WAFER_VERSION_MINOR: EfuseField = EfuseField::new(2, 48, 4);

impl ChipDefinition for Esp32c2 {
    fn name(&self) -> &'static str {
        "ESP32-C2"
    }

    fn chip_id(&self) -> Option<u16> {
        Some(12)
    }

    fn magic_values(&self) -> &'static [u32] {
        &[
            0x6F51_306F, // ECO0
            0x7C41_A06F, // ECO1
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
        Some(include_str!("../../stubs/esp32c2.toml"))
    }

    fn revision(&self, conn: &mut Connection) -> Result<(u32, u32)> {
        Ok((
            read_efuse(conn, self, WAFER_VERSION_MAJOR)?,
            read_efuse(conn, self, WAFER_VERSION_MINOR)?,
        ))
    }

    fn xtal_mhz(&self, conn: &mut Connection) -> Result<u32> {
        super::detect_xtal_via_uart_clkdiv(conn, 0x6000_0014, 1)
    }

    fn features(&self, _conn: &mut Connection) -> Result<Vec<String>> {
        Ok(vec!["WiFi".into(), "BLE".into()])
    }
}
