//! ESP32-E22 芯片定义（esptool 2026 新增目标，部分 eFuse 字段尚未定义）。
//!
//! 对照 esptool `targets/esp32e22.py`。
//! 注意：esptool 目前未提供 E22 的 flasher stub，本芯片以 ROM loader 运行；
//! 芯片版本字段尚未在 eFuse 表中分配，固定返回 v0.0。

use super::{spi_regs_v2_at, ChipDefinition, EfuseField, SpiRegisters};
use crate::connection::Connection;
use crate::error::Result;

pub struct Esp32e22;

/// EFUSE_BASE = 0xC4008000；block0 读地址 +0x030，block1 +0x044。
const EFUSE_BLOCKS: &[u32] = &[0xC400_8030, 0xC400_8044];

const MAC0: EfuseField = EfuseField::new(1, 0, 32);
const MAC1: EfuseField = EfuseField::new(1, 32, 16);

impl ChipDefinition for Esp32e22 {
    fn name(&self) -> &'static str {
        "ESP32-E22"
    }

    fn chip_id(&self) -> Option<u16> {
        Some(31)
    }

    /// esptool 标注 USES_MAGIC_VALUE = False，仅按 chip_id 识别。
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
        // SPIMEM1
        spi_regs_v2_at(0xC300_3000)
    }

    /// esptool 尚未发布 E22 stub，回落 ROM loader。
    fn stub_source(&self, _revision: Option<(u32, u32)>) -> Option<&'static str> {
        None
    }

    /// 版本字段尚未分配（esptool 同样固定返回 0）。
    fn revision(&self, _conn: &mut Connection) -> Result<(u32, u32)> {
        Ok((0, 0))
    }

    fn xtal_mhz(&self, conn: &mut Connection) -> Result<u32> {
        // UART_CLKDIV_REG = 0xC3102000 + 0x14
        super::detect_xtal_via_uart_clkdiv(conn, 0xC310_2014, 1)
    }

    fn features(&self, _conn: &mut Connection) -> Result<Vec<String>> {
        Ok(vec![
            "WiFi 6E (tri-band, 2x2 MU-MIMO)".into(),
            "BT 5.4 (LE) + Classic".into(),
            "Dual Core".into(),
            "500MHz".into(),
        ])
    }
}
