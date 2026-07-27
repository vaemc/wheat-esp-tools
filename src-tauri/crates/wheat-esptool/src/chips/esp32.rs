//! ESP32 芯片定义。

use super::{
    read_efuse, ChipDefinition, EfuseField, SpiRegisters,
};
use crate::connection::Connection;
use crate::error::Result;

pub struct Esp32;

/// eFuse 各块读地址。
const EFUSE_BLOCKS: &[u32] = &[0x3FF5_A000, 0x3FF5_A038, 0x3FF5_A058, 0x3FF5_A078];

const MAC0: EfuseField = EfuseField::new(0, 32, 32);
const MAC1: EfuseField = EfuseField::new(0, 64, 16);
const WAFER_VERSION_MINOR: EfuseField = EfuseField::new(0, 184, 2);
const DISABLE_APP_CPU: EfuseField = EfuseField::new(0, 96, 1);
const DISABLE_BT: EfuseField = EfuseField::new(0, 97, 1);
const CHIP_CPU_FREQ_LOW: EfuseField = EfuseField::new(0, 108, 1);
const CHIP_CPU_FREQ_RATED: EfuseField = EfuseField::new(0, 109, 1);
const BLK3_PART_RESERVE: EfuseField = EfuseField::new(0, 110, 1);
const ADC_VREF: EfuseField = EfuseField::new(0, 136, 5);
const CODING_SCHEME: EfuseField = EfuseField::new(0, 192, 2);

impl Esp32 {
    /// 封装版本（word3 的 bit9..12 + bit2）。
    fn package_version(&self, conn: &mut Connection) -> Result<u32> {
        let word3 = conn.read_reg(EFUSE_BLOCKS[0] + 3 * 4)?;
        let pkg = (word3 >> 9) & 0x7;
        Ok(pkg + (((word3 >> 2) & 0x1) << 3))
    }
}

impl ChipDefinition for Esp32 {
    fn name(&self) -> &'static str {
        "ESP32"
    }

    fn chip_id(&self) -> Option<u16> {
        // ESP32 的 ROM 不支持 GET_SECURITY_INFO，只能靠 magic 识别
        None
    }

    fn magic_values(&self) -> &'static [u32] {
        &[0x00F0_1D83]
    }

    fn efuse_block_read_addrs(&self) -> &'static [u32] {
        EFUSE_BLOCKS
    }

    fn mac_fields(&self) -> (EfuseField, EfuseField) {
        (MAC0, MAC1)
    }

    fn spi_registers(&self) -> SpiRegisters {
        SpiRegisters {
            base: 0x3FF4_2000,
            usr_offset: 0x1C,
            usr1_offset: 0x20,
            usr2_offset: 0x24,
            w0_offset: 0x80,
            mosi_length_offset: Some(0x28),
            miso_length_offset: Some(0x2C),
        }
    }

    fn rom_flash_begin_has_encrypt_flag(&self) -> bool {
        false
    }

    fn stub_source(&self, _revision: Option<(u32, u32)>) -> Option<&'static str> {
        Some(include_str!("../../stubs/esp32.toml"))
    }

    fn revision(&self, conn: &mut Connection) -> Result<(u32, u32)> {
        // major：三个分散的 bit 组合（word3 bit15 / word5 bit20 / APB_CTL_DATE bit31）
        let apb_ctl_date = conn.read_reg(0x3FF6_607C)?;
        let word3 = conn.read_reg(EFUSE_BLOCKS[0] + 3 * 4)?;
        let word5 = conn.read_reg(EFUSE_BLOCKS[0] + 5 * 4)?;

        let rev_bit0 = (word3 >> 15) & 0x1;
        let rev_bit1 = (word5 >> 20) & 0x1;
        let rev_bit2 = (apb_ctl_date >> 31) & 0x1;

        let major = match (rev_bit2 << 2) | (rev_bit1 << 1) | rev_bit0 {
            1 => 1,
            3 => 2,
            7 => 3,
            _ => 0,
        };
        let minor = read_efuse(conn, self, WAFER_VERSION_MINOR)?;
        Ok((major, minor))
    }

    fn xtal_mhz(&self, conn: &mut Connection) -> Result<u32> {
        super::detect_xtal_via_uart_clkdiv(conn, 0x3FF4_0014, 1)
    }

    fn features(&self, conn: &mut Connection) -> Result<Vec<String>> {
        let mut features = vec!["WiFi".to_string()];

        if read_efuse(conn, self, DISABLE_BT)? == 0 {
            features.push("BT".into());
        }
        if read_efuse(conn, self, DISABLE_APP_CPU)? == 0 {
            features.push("Dual Core".into());
        } else {
            features.push("Single Core".into());
        }
        if read_efuse(conn, self, CHIP_CPU_FREQ_RATED)? != 0 {
            if read_efuse(conn, self, CHIP_CPU_FREQ_LOW)? != 0 {
                features.push("160MHz".into());
            } else {
                features.push("240MHz".into());
            }
        }

        let pkg_version = self.package_version(conn)?;
        if [2, 4, 5, 6].contains(&pkg_version) {
            features.push("Embedded Flash".into());
        }
        if pkg_version == 6 {
            features.push("Embedded PSRAM".into());
        }
        if read_efuse(conn, self, ADC_VREF)? != 0 {
            features.push("VRef calibration in efuse".into());
        }
        if read_efuse(conn, self, BLK3_PART_RESERVE)? != 0 {
            features.push("BLK3 partially reserved".into());
        }
        features.push(
            match read_efuse(conn, self, CODING_SCHEME)? {
                0 => "Coding Scheme None",
                1 => "Coding Scheme 3/4",
                2 => "Coding Scheme Repeat (UNSUPPORTED)",
                _ => "Coding Scheme Invalid",
            }
            .into(),
        );
        Ok(features)
    }

    fn supports_get_security_info(&self) -> bool {
        false
    }
}
