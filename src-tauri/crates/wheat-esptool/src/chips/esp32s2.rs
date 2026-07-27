//! ESP32-S2 芯片定义。

use super::{
    read_efuse, ChipDefinition, EfuseField, SpiRegisters,
};
use crate::connection::Connection;
use crate::error::Result;

pub struct Esp32s2;

const EFUSE_BLOCKS: &[u32] = &[0x3F41_A02C, 0x3F41_A044, 0x3F41_A05C, 0x3F41_A07C];

const MAC0: EfuseField = EfuseField::new(1, 0, 32);
const MAC1: EfuseField = EfuseField::new(1, 32, 16);
const WAFER_VERSION_MAJOR: EfuseField = EfuseField::new(1, 114, 2);
const WAFER_VERSION_MINOR_HI: EfuseField = EfuseField::new(1, 116, 1);
const WAFER_VERSION_MINOR_LO: EfuseField = EfuseField::new(1, 132, 3);
const FLASH_VERSION: EfuseField = EfuseField::new(1, 117, 4);
const PSRAM_VERSION: EfuseField = EfuseField::new(1, 124, 4);
const BLK_VERSION_MINOR: EfuseField = EfuseField::new(2, 132, 3);

impl ChipDefinition for Esp32s2 {
    fn name(&self) -> &'static str {
        "ESP32-S2"
    }

    fn chip_id(&self) -> Option<u16> {
        Some(2)
    }

    fn magic_values(&self) -> &'static [u32] {
        &[0x0000_07C6]
    }

    fn efuse_block_read_addrs(&self) -> &'static [u32] {
        EFUSE_BLOCKS
    }

    fn mac_fields(&self) -> (EfuseField, EfuseField) {
        (MAC0, MAC1)
    }

    fn spi_registers(&self) -> SpiRegisters {
        SpiRegisters {
            base: 0x3F40_2000,
            usr_offset: 0x18,
            usr1_offset: 0x1C,
            usr2_offset: 0x20,
            w0_offset: 0x58,
            mosi_length_offset: Some(0x24),
            miso_length_offset: Some(0x28),
        }
    }

    fn stub_source(&self, _revision: Option<(u32, u32)>) -> Option<&'static str> {
        Some(include_str!("../../stubs/esp32s2.toml"))
    }

    fn revision(&self, conn: &mut Connection) -> Result<(u32, u32)> {
        let major = read_efuse(conn, self, WAFER_VERSION_MAJOR)?;
        let hi = read_efuse(conn, self, WAFER_VERSION_MINOR_HI)?;
        let lo = read_efuse(conn, self, WAFER_VERSION_MINOR_LO)?;
        Ok((major, (hi << 3) + lo))
    }

    fn features(&self, conn: &mut Connection) -> Result<Vec<String>> {
        let mut features = vec!["WiFi".to_string()];

        features.push(
            match read_efuse(conn, self, FLASH_VERSION)? {
                0 => "No Embedded Flash",
                1 => "Embedded Flash 2MB",
                2 => "Embedded Flash 4MB",
                _ => "Unknown Embedded Flash",
            }
            .into(),
        );
        features.push(
            match read_efuse(conn, self, PSRAM_VERSION)? {
                0 => "No Embedded PSRAM",
                1 => "Embedded PSRAM 2MB",
                2 => "Embedded PSRAM 4MB",
                _ => "Unknown Embedded PSRAM",
            }
            .into(),
        );
        features.push(
            match read_efuse(conn, self, BLK_VERSION_MINOR)? {
                0 => "No calibration in BLK2 of efuse",
                1 => "ADC and temperature sensor calibration in BLK2 of efuse V1",
                2 => "ADC and temperature sensor calibration in BLK2 of efuse V2",
                _ => "Unknown Calibration in BLK2",
            }
            .into(),
        );
        Ok(features)
    }
}
