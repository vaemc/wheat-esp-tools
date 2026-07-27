//! ESP32-P4 芯片定义。
//!
//! 特殊点：
//! - 按芯片版本选择 stub（v3.0 之前用 RC1 stub）
//! - ECO6/ECO7（v3.01 / v3.02）需要在下载模式先给 Flash 上电

use std::{thread::sleep, time::Duration};

use super::{
    read_efuse, ChipDefinition, EfuseField, SpiRegisters,
};
use crate::connection::Connection;
use crate::error::Result;

pub struct Esp32p4;

const EFUSE_BLOCKS: &[u32] = &[0x5012_D02C, 0x5012_D044, 0x5012_D05C, 0x5012_D07C];

const MAC0: EfuseField = EfuseField::new(1, 0, 32);
const MAC1: EfuseField = EfuseField::new(1, 32, 16);
const WAFER_VERSION_MAJOR_HI: EfuseField = EfuseField::new(1, 87, 1);
const WAFER_VERSION_MAJOR_LO: EfuseField = EfuseField::new(1, 68, 2);
const WAFER_VERSION_MINOR: EfuseField = EfuseField::new(1, 64, 4);

impl ChipDefinition for Esp32p4 {
    fn name(&self) -> &'static str {
        "ESP32-P4"
    }

    fn chip_id(&self) -> Option<u16> {
        Some(18)
    }

    fn magic_values(&self) -> &'static [u32] {
        &[0x0, 0x0ADD_BAD0]
    }

    fn efuse_block_read_addrs(&self) -> &'static [u32] {
        EFUSE_BLOCKS
    }

    fn mac_fields(&self) -> (EfuseField, EfuseField) {
        (MAC0, MAC1)
    }

    fn spi_registers(&self) -> SpiRegisters {
        SpiRegisters {
            base: 0x5008_D000,
            usr_offset: 0x18,
            usr1_offset: 0x1C,
            usr2_offset: 0x20,
            w0_offset: 0x58,
            mosi_length_offset: Some(0x24),
            miso_length_offset: Some(0x28),
        }
    }

    fn stub_source(&self, revision: Option<(u32, u32)>) -> Option<&'static str> {
        // v3.0 之前的硅片需要 RC1 stub（与 esptool 行为一致）
        let rev_number = revision.map(|(major, minor)| major * 100 + minor);
        if rev_number.unwrap_or(300) < 300 {
            Some(include_str!("../../stubs/esp32p4rc1.toml"))
        } else {
            Some(include_str!("../../stubs/esp32p4.toml"))
        }
    }

    fn revision(&self, conn: &mut Connection) -> Result<(u32, u32)> {
        let hi = read_efuse(conn, self, WAFER_VERSION_MAJOR_HI)?;
        let lo = read_efuse(conn, self, WAFER_VERSION_MAJOR_LO)?;
        let minor = read_efuse(conn, self, WAFER_VERSION_MINOR)?;
        Ok(((hi << 2) | lo, minor))
    }

    fn features(&self, _conn: &mut Connection) -> Result<Vec<String>> {
        Ok(vec!["High-Performance MCU".into()])
    }

    /// ECO6/ECO7 的 Flash 默认断电，加载 stub 前需要手动上电。
    fn post_connect(&self, conn: &mut Connection, revision: Option<(u32, u32)>) -> Result<()> {
        const EFUSE_RD_REPEAT_DATA1_REG: u32 = 0x5012_D034;
        const EFUSE_DOWNLOAD_MODE_XPD_ON_MASK: u32 = 1 << 16;
        const LP_SYSTEM_REG_ANA_XPD_PAD_GROUP_REG: u32 = 0x5011_010C;
        const PMU_EXT_LDO_P0_0P1A_REG: u32 = 0x5011_51B8;
        const PMU_EXT_LDO_P0_0P1A_ANA_REG: u32 = 0x5011_51BC;
        const PMU_DATE_REG: u32 = 0x5011_53FC;
        const PMU_ANA_0P1A_EN_CUR_LIM_0: u32 = 1 << 27;
        const PMU_0P1A_FORCE_TIEH_SEL_0: u32 = 1 << 7;
        const PMU_0P1A_TARGET0_0: u32 = 0xFF << 23;

        let Some((major, minor)) = revision else {
            return Ok(());
        };
        let rev = major * 100 + minor;
        // 只有 ECO6 (301) / ECO7 (302) 需要该时序
        if !matches!(rev, 301 | 302) {
            return Ok(());
        }

        // ECO7 若烧写了 DOWNLOAD_MODE_XPD_ON，ROM 已经把 Flash 拉起，
        // 只需清理 ROM 遗留的强制上电状态。
        if rev == 302
            && (conn.read_reg(EFUSE_RD_REPEAT_DATA1_REG)? & EFUSE_DOWNLOAD_MODE_XPD_ON_MASK) != 0
        {
            conn.write_reg(PMU_DATE_REG, 0, None)?;
            return Ok(());
        }

        // 上电 pad group
        conn.write_reg(LP_SYSTEM_REG_ANA_XPD_PAD_GROUP_REG, 1, None)?;
        sleep(Duration::from_millis(10));

        // Flash 上电时序
        let v = conn.read_reg(PMU_EXT_LDO_P0_0P1A_ANA_REG)?;
        conn.write_reg(PMU_EXT_LDO_P0_0P1A_ANA_REG, v | PMU_ANA_0P1A_EN_CUR_LIM_0, None)?;

        let v = conn.read_reg(PMU_EXT_LDO_P0_0P1A_REG)?;
        conn.write_reg(PMU_EXT_LDO_P0_0P1A_REG, v | PMU_0P1A_FORCE_TIEH_SEL_0, None)?;

        let v = conn.read_reg(PMU_DATE_REG)?;
        conn.write_reg(PMU_DATE_REG, v | 3, None)?;
        sleep(Duration::from_micros(50));

        let v = conn.read_reg(PMU_EXT_LDO_P0_0P1A_ANA_REG)?;
        conn.write_reg(PMU_EXT_LDO_P0_0P1A_ANA_REG, v & !PMU_ANA_0P1A_EN_CUR_LIM_0, None)?;

        let v = conn.read_reg(PMU_EXT_LDO_P0_0P1A_REG)?;
        conn.write_reg(PMU_EXT_LDO_P0_0P1A_REG, v & !PMU_0P1A_TARGET0_0, None)?;

        // 让 eFuse 电压参数同步到 PMU
        let v = conn.read_reg(PMU_EXT_LDO_P0_0P1A_REG)?;
        conn.write_reg(PMU_EXT_LDO_P0_0P1A_REG, v | 0x80, None)?;

        let v = conn.read_reg(PMU_EXT_LDO_P0_0P1A_REG)?;
        conn.write_reg(PMU_EXT_LDO_P0_0P1A_REG, v & !PMU_0P1A_FORCE_TIEH_SEL_0, None)?;

        sleep(Duration::from_micros(1_800));
        Ok(())
    }
}
