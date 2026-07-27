//! ESP32-S3 芯片定义。

use super::{
    read_efuse, ChipDefinition, EfuseField, SpiRegisters, SPI_REGS_V2_0X60002000,
};
use crate::connection::Connection;
use crate::error::Result;

pub struct Esp32s3;

const EFUSE_BLOCKS: &[u32] = &[0x6000_702C, 0x6000_7044, 0x6000_705C, 0x6000_707C];

const MAC0: EfuseField = EfuseField::new(1, 0, 32);
const MAC1: EfuseField = EfuseField::new(1, 32, 16);
const WAFER_VERSION_MAJOR: EfuseField = EfuseField::new(1, 184, 2);
const WAFER_VERSION_MINOR_HI: EfuseField = EfuseField::new(1, 183, 1);
const WAFER_VERSION_MINOR_LO: EfuseField = EfuseField::new(1, 114, 3);
const BLK_VERSION_MAJOR: EfuseField = EfuseField::new(2, 128, 2);
const BLK_VERSION_MINOR: EfuseField = EfuseField::new(1, 120, 3);

impl Esp32s3 {
    /// 早期 S3（rev0）的 eFuse 版本字段有特殊布局，需要单独判断。
    fn is_blk_version_1_1(&self, conn: &mut Connection) -> Result<bool> {
        Ok(read_efuse(conn, self, BLK_VERSION_MAJOR)? == 1
            && read_efuse(conn, self, BLK_VERSION_MINOR)? == 1)
    }
}

impl ChipDefinition for Esp32s3 {
    fn name(&self) -> &'static str {
        "ESP32-S3"
    }

    fn chip_id(&self) -> Option<u16> {
        Some(9)
    }

    fn magic_values(&self) -> &'static [u32] {
        &[0x9]
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
        Some(include_str!("../../stubs/esp32s3.toml"))
    }

    fn revision(&self, conn: &mut Connection) -> Result<(u32, u32)> {
        let major = if self.is_blk_version_1_1(conn)? {
            0
        } else {
            read_efuse(conn, self, WAFER_VERSION_MAJOR)?
        };
        let hi = read_efuse(conn, self, WAFER_VERSION_MINOR_HI)?;
        let lo = read_efuse(conn, self, WAFER_VERSION_MINOR_LO)?;
        Ok((major, (hi << 3) + lo))
    }

    fn features(&self, conn: &mut Connection) -> Result<Vec<String>> {
        let mut features = vec!["WiFi".to_string(), "BLE".to_string()];
        if self.is_blk_version_1_1(conn)? {
            features.push("Embedded PSRAM".into());
        } else {
            features.push("Embedded Flash".into());
        }
        Ok(features)
    }
}
