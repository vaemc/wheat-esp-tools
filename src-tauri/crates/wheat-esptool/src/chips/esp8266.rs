//! ESP8266 芯片定义（协议差异最大的老芯片）。
//!
//! 对照 esptool `targets/esp8266.py`，主要差异：
//! - 无 GET_SECURITY_INFO / eFuse 控制器，MAC 从 OTP ROM 寄存器读取；
//! - SPI 控制器无独立 MOSI/MISO 长度寄存器（长度打包进 USR1）；
//! - ROM 不支持 SPI_ATTACH / SPI_SET_PARAMS（stub 支持）；
//! - ROM FLASH_BEGIN 只接受 4 个参数字，且擦除长度需按 bug 折算。

use super::{ChipDefinition, EfuseField, SpiRegisters};
use crate::connection::Connection;
use crate::error::Result;
use crate::flasher::FLASH_SECTOR_SIZE;

pub struct Esp8266;

/// OTP ROM 地址（esptool ESP_OTP_MAC*）。
const OTP_MAC0: u32 = 0x3FF0_0050;
const OTP_MAC1: u32 = 0x3FF0_0054;
const OTP_MAC2: u32 = 0x3FF0_0058;
const OTP_MAC3: u32 = 0x3FF0_005C;

impl ChipDefinition for Esp8266 {
    fn name(&self) -> &'static str {
        "ESP8266"
    }

    /// 不支持 GET_SECURITY_INFO，无 chip_id。
    fn chip_id(&self) -> Option<u16> {
        None
    }

    fn magic_values(&self) -> &'static [u32] {
        &[0xFFF0_C101]
    }

    /// ESP8266 无 eFuse 控制器，MAC 走 `mac_address` 覆盖实现。
    fn efuse_block_read_addrs(&self) -> &'static [u32] {
        &[]
    }

    /// 占位；`mac_address` 已覆盖，不会被调用。
    fn mac_fields(&self) -> (EfuseField, EfuseField) {
        (EfuseField::new(0, 0, 0), EfuseField::new(0, 0, 0))
    }

    fn spi_registers(&self) -> SpiRegisters {
        SpiRegisters {
            base: 0x6000_0200,
            usr_offset: 0x1C,
            usr1_offset: 0x20,
            usr2_offset: 0x24,
            w0_offset: 0x40,
            // 无独立长度寄存器：长度打包写入 USR1
            mosi_length_offset: None,
            miso_length_offset: None,
        }
    }

    fn stub_source(&self, _revision: Option<(u32, u32)>) -> Option<&'static str> {
        Some(include_str!("../../stubs/esp8266.toml"))
    }

    /// ESP8266 无版本 eFuse。
    fn revision(&self, _conn: &mut Connection) -> Result<(u32, u32)> {
        Err(crate::error::Error::Unsupported { what: "revision" })
    }

    fn xtal_mhz(&self, conn: &mut Connection) -> Result<u32> {
        // UART_CLKDIV_REG = 0x60000014；XTAL_CLK_DIVIDER = 2
        super::detect_xtal_via_uart_clkdiv(conn, 0x6000_0014, 2)
    }

    fn features(&self, conn: &mut Connection) -> Result<Vec<String>> {
        let mut features = vec!["WiFi".to_string(), "160MHz".to_string()];
        // ESP8285 判定：efuse word0 bit4 或 word2 bit16 置位（对应内嵌 Flash）
        let word0 = conn.read_reg(OTP_MAC0)?;
        let word2 = conn.read_reg(OTP_MAC2)?;
        if word0 & (1 << 4) != 0 || word2 & (1 << 16) != 0 {
            features.push("Embedded Flash".into());
        }
        Ok(features)
    }

    fn supports_get_security_info(&self) -> bool {
        false
    }

    fn supports_spi_attach(&self) -> bool {
        false
    }

    fn rom_flash_begin_has_encrypt_flag(&self) -> bool {
        false
    }

    /// ROM loader 擦除 bug 折算（esptool `get_erase_size`）。
    fn rom_erase_size(&self, offset: u32, size: u32) -> u32 {
        const SECTORS_PER_BLOCK: u32 = 16;
        let sector_size = FLASH_SECTOR_SIZE as u32;
        let num_sectors = size.div_ceil(sector_size);
        let start_sector = offset / sector_size;

        let head_sectors =
            (SECTORS_PER_BLOCK - (start_sector % SECTORS_PER_BLOCK)).min(num_sectors);

        if num_sectors < 2 * head_sectors {
            num_sectors.div_ceil(2) * sector_size
        } else {
            (num_sectors - head_sectors) * sector_size
        }
    }

    /// MAC 从 OTP ROM 读取（esptool `read_mac`）。
    fn mac_address(&self, conn: &mut Connection) -> Result<String> {
        let mac0 = conn.read_reg(OTP_MAC0)?;
        let mac1 = conn.read_reg(OTP_MAC1)?;
        let mac3 = conn.read_reg(OTP_MAC3)?;

        let oui: [u8; 3] = if mac3 != 0 {
            [(mac3 >> 16) as u8, (mac3 >> 8) as u8, mac3 as u8]
        } else if (mac1 >> 16) & 0xFF == 0 {
            [0x18, 0xFE, 0x34]
        } else if (mac1 >> 16) & 0xFF == 1 {
            [0xAC, 0xD0, 0x74]
        } else {
            return Err(crate::error::Error::InvalidResponse(
                "esp8266_unknown_oui".into(),
            ));
        };

        let bytes = [
            oui[0],
            oui[1],
            oui[2],
            (mac1 >> 8) as u8,
            mac1 as u8,
            (mac0 >> 24) as u8,
        ];
        Ok(bytes
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<Vec<_>>()
            .join(":"))
    }
}
