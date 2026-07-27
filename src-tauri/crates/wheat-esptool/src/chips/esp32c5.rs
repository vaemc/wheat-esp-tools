//! ESP32-C5 芯片定义。

use super::{
    read_efuse, ChipDefinition, EfuseField, SpiRegisters, SPI_REGS_V2_0X60003000,
};
use crate::connection::Connection;
use crate::error::Result;

pub struct Esp32c5;

const EFUSE_BLOCKS: &[u32] = &[0x600B_482C, 0x600B_4844, 0x600B_485C, 0x600B_487C];

const MAC0: EfuseField = EfuseField::new(1, 0, 32);
const MAC1: EfuseField = EfuseField::new(1, 32, 16);
const WAFER_VERSION_MAJOR: EfuseField = EfuseField::new(1, 68, 2);
const WAFER_VERSION_MINOR: EfuseField = EfuseField::new(1, 64, 4);

impl ChipDefinition for Esp32c5 {
    fn name(&self) -> &'static str {
        "ESP32-C5"
    }

    fn chip_id(&self) -> Option<u16> {
        Some(23)
    }

    fn magic_values(&self) -> &'static [u32] {
        &[0x1101_406F, 0x63E1_406F, 0x5FD1_406F]
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
        Some(include_str!("../../stubs/esp32c5.toml"))
    }

    fn revision(&self, conn: &mut Connection) -> Result<(u32, u32)> {
        Ok((
            read_efuse(conn, self, WAFER_VERSION_MAJOR)?,
            read_efuse(conn, self, WAFER_VERSION_MINOR)?,
        ))
    }

    fn xtal_mhz(&self, conn: &mut Connection) -> Result<u32> {
        // PCR_SYSCLK_CONF_REG 的 bit24..31 是当前晶振频率
        const PCR_SYSCLK_CONF_REG: u32 = 0x6009_6110;
        let reg = conn.read_reg(PCR_SYSCLK_CONF_REG)?;
        let est = (reg >> 24) & 0x7F;
        Ok(if est > 45 { 48 } else { 40 })
    }

    fn features(&self, _conn: &mut Connection) -> Result<Vec<String>> {
        Ok(vec![
            "WiFi".into(),
            "BLE".into(),
            "IEEE802.15.4".into(),
            "240MHz".into(),
        ])
    }
}
