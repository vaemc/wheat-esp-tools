//! 芯片定义与注册表。
//!
//! 每种芯片一个文件（`esp32.rs`、`esp32c3.rs`…），实现 [`ChipDefinition`]
//! 后加入 [`CHIPS`] 注册表即可被自动识别。新增芯片的完整步骤见 crate 根目录
//! 的 `README.md`。

use crate::connection::Connection;
use crate::error::{Error, Result};
use crate::stub::{parse_stub_toml, StubImage};

mod esp32;
mod esp32c2;
mod esp32c3;
mod esp32c5;
mod esp32c6;
mod esp32c61;
mod esp32e22;
mod esp32h2;
mod esp32h21;
mod esp32h4;
mod esp32p4;
mod esp32s2;
mod esp32s3;
mod esp32s31;
mod esp8266;

/// eFuse 字段位置：块号 + 块内起始 bit + 位宽（≤32）。
///
/// 与 espressif 官方 efuse 表一致，`bit_start` 是相对块起始的绝对 bit 偏移。
#[derive(Debug, Clone, Copy)]
pub struct EfuseField {
    pub block: u32,
    pub bit_start: u32,
    pub bit_count: u32,
}

impl EfuseField {
    pub const fn new(block: u32, bit_start: u32, bit_count: u32) -> Self {
        Self {
            block,
            bit_start,
            bit_count,
        }
    }
}

/// SPI 控制器寄存器地址（flash_id 探测使用）。
///
/// `mosi_length_offset` / `miso_length_offset` 为 `None` 时（仅 ESP8266），
/// 数据长度打包写入 USR1 寄存器（见 `Flasher::run_spiflash_command`）。
#[derive(Debug, Clone, Copy)]
pub struct SpiRegisters {
    pub base: u32,
    pub usr_offset: u32,
    pub usr1_offset: u32,
    pub usr2_offset: u32,
    pub w0_offset: u32,
    pub mosi_length_offset: Option<u32>,
    pub miso_length_offset: Option<u32>,
}

impl SpiRegisters {
    pub fn cmd(&self) -> u32 {
        self.base
    }
    pub fn usr(&self) -> u32 {
        self.base + self.usr_offset
    }
    pub fn usr1(&self) -> u32 {
        self.base + self.usr1_offset
    }
    pub fn usr2(&self) -> u32 {
        self.base + self.usr2_offset
    }
    pub fn w0(&self) -> u32 {
        self.base + self.w0_offset
    }
    pub fn mosi_length(&self) -> Option<u32> {
        self.mosi_length_offset.map(|off| self.base + off)
    }
    pub fn miso_length(&self) -> Option<u32> {
        self.miso_length_offset.map(|off| self.base + off)
    }
}

/// ESP32-C2/C3/S3 一代的 SPI 寄存器布局。
pub(crate) const SPI_REGS_V2_0X60002000: SpiRegisters = SpiRegisters {
    base: 0x6000_2000,
    usr_offset: 0x18,
    usr1_offset: 0x1C,
    usr2_offset: 0x20,
    w0_offset: 0x58,
    mosi_length_offset: Some(0x24),
    miso_length_offset: Some(0x28),
};

/// ESP32-C5/C6/H2 一代的 SPI 寄存器布局。
pub(crate) const SPI_REGS_V2_0X60003000: SpiRegisters = SpiRegisters {
    base: 0x6000_3000,
    usr_offset: 0x18,
    usr1_offset: 0x1C,
    usr2_offset: 0x20,
    w0_offset: 0x58,
    mosi_length_offset: Some(0x24),
    miso_length_offset: Some(0x28),
};

/// 从指定基址派生「标准 v2 偏移」的 SPI 寄存器布局（H4 / E22 / S31 等新芯片）。
pub(crate) const fn spi_regs_v2_at(base: u32) -> SpiRegisters {
    SpiRegisters {
        base,
        usr_offset: 0x18,
        usr1_offset: 0x1C,
        usr2_offset: 0x20,
        w0_offset: 0x58,
        mosi_length_offset: Some(0x24),
        miso_length_offset: Some(0x28),
    }
}

/// 单个芯片的全部差异点。实现该 trait 并注册到 [`CHIPS`] 即完成新芯片接入。
pub trait ChipDefinition: Sync + Send {
    /// 显示名称，如 `"ESP32-C3"`。
    fn name(&self) -> &'static str;

    /// GET_SECURITY_INFO 返回的 chip_id（新芯片识别的首选途径）。
    fn chip_id(&self) -> Option<u16>;

    /// `0x40001000` 寄存器的 magic 值列表（老芯片识别途径，不同 ECO 可能不同）。
    fn magic_values(&self) -> &'static [u32];

    /// eFuse 各块的读地址（索引即块号），至少要覆盖 MAC / 版本字段所在块。
    fn efuse_block_read_addrs(&self) -> &'static [u32];

    /// MAC 地址字段：(低 32 位, 高 16 位)。
    fn mac_fields(&self) -> (EfuseField, EfuseField);

    /// SPI 控制器寄存器（flash id 探测使用）。
    fn spi_registers(&self) -> SpiRegisters;

    /// stub loader 的 TOML 内容（`include_str!` 内嵌）。
    /// 部分芯片按硬件版本区分 stub（如 ESP32-P4）。
    fn stub_source(&self, revision: Option<(u32, u32)>) -> Option<&'static str>;

    /// 芯片版本 (major, minor)。
    fn revision(&self, conn: &mut Connection) -> Result<(u32, u32)>;

    /// 晶振频率（MHz）。大多数芯片固定 40MHz。
    fn xtal_mhz(&self, _conn: &mut Connection) -> Result<u32> {
        Ok(40)
    }

    /// 芯片特性列表（WiFi / BLE / 内嵌 Flash 等）。
    fn features(&self, conn: &mut Connection) -> Result<Vec<String>>;

    /// ROM 是否支持 GET_SECURITY_INFO（ESP32 / ESP8266 不支持）。
    fn supports_get_security_info(&self) -> bool {
        true
    }

    /// 是否支持 SPI_ATTACH 命令（仅 ESP8266 ROM 不支持，由 FLASH_BEGIN 隐式附加）。
    fn supports_spi_attach(&self) -> bool {
        true
    }

    /// ROM loader 的 FLASH_BEGIN 是否需要追加 encrypted 标志字
    /// （ESP32 / ESP8266 的 ROM 只接受 4 个参数字）。
    fn rom_flash_begin_has_encrypt_flag(&self) -> bool {
        true
    }

    /// ROM loader FLASH_BEGIN 的擦除字节数。
    /// 默认按扇区向上对齐；ESP8266 ROM 有擦除 bug 需要特殊折算。
    fn rom_erase_size(&self, _offset: u32, size: u32) -> u32 {
        ((size as usize).div_ceil(crate::flasher::FLASH_SECTOR_SIZE)
            * crate::flasher::FLASH_SECTOR_SIZE) as u32
    }

    /// 连接建立后、加载 stub 前的芯片专属准备动作
    /// （例如 ESP32-P4 ECO6/ECO7 需要先给 Flash 上电）。
    fn post_connect(&self, _conn: &mut Connection, _revision: Option<(u32, u32)>) -> Result<()> {
        Ok(())
    }

    /// ROM loader 单包写入大小。
    fn flash_write_size_rom(&self) -> usize {
        0x400
    }

    /// stub loader 单包写入大小。
    fn flash_write_size_stub(&self) -> usize {
        0x4000
    }

    /// 读取并解析 stub 镜像。
    fn stub(&self, revision: Option<(u32, u32)>) -> Result<Option<StubImage>> {
        match self.stub_source(revision) {
            Some(src) => Ok(Some(parse_stub_toml(src)?)),
            None => Ok(None),
        }
    }

    /// 读取 MAC 地址（默认实现按 `mac_fields` 拼接 48 位）。
    fn mac_address(&self, conn: &mut Connection) -> Result<String> {
        let (mac0_field, mac1_field) = self.mac_fields();
        let mac0 = read_efuse(conn, self, mac0_field)? as u64;
        let mac1 = read_efuse(conn, self, mac1_field)? as u64;
        let combined = (mac1 << 32) | mac0;
        let bytes = combined.to_be_bytes();
        Ok(bytes[2..]
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<Vec<_>>()
            .join(":"))
    }
}

/// 所有已支持芯片的注册表。
///
/// **新增芯片時只需要在此追加一项**（顺序无关，识别按 chip_id / magic 匹配）。
pub static CHIPS: &[&dyn ChipDefinition] = &[
    &esp32::Esp32,
    &esp32c2::Esp32c2,
    &esp32c3::Esp32c3,
    &esp32c5::Esp32c5,
    &esp32c6::Esp32c6,
    &esp32c61::Esp32c61,
    &esp32e22::Esp32e22,
    &esp32h2::Esp32h2,
    &esp32h21::Esp32h21,
    &esp32h4::Esp32h4,
    &esp32p4::Esp32p4,
    &esp32s2::Esp32s2,
    &esp32s3::Esp32s3,
    &esp32s31::Esp32s31,
    &esp8266::Esp8266,
];

/// 按 GET_SECURITY_INFO 的 chip_id 查找芯片。
pub fn find_by_chip_id(id: u16) -> Option<&'static dyn ChipDefinition> {
    CHIPS
        .iter()
        .copied()
        .find(|c| c.chip_id() == Some(id))
}

/// 按 magic 寄存器值查找芯片。
pub fn find_by_magic(magic: u32) -> Option<&'static dyn ChipDefinition> {
    CHIPS
        .iter()
        .copied()
        .find(|c| c.magic_values().contains(&magic))
}

/// 读取 eFuse 字段（最多 32 位，可跨相邻两个字）。
pub fn read_efuse(
    conn: &mut Connection,
    chip: &(impl ChipDefinition + ?Sized),
    field: EfuseField,
) -> Result<u32> {
    let addrs = chip.efuse_block_read_addrs();
    let base = *addrs
        .get(field.block as usize)
        .ok_or(Error::Unsupported {
            what: "efuse_block",
        })?;

    let word_index = field.bit_start / 32;
    let shift = field.bit_start % 32;
    let word = conn.read_reg(base + word_index * 4)?;
    let mut value = word >> shift;

    let bits_available = 32 - shift;
    if field.bit_count > bits_available {
        let next = conn.read_reg(base + (word_index + 1) * 4)?;
        value |= next.wrapping_shl(bits_available);
    }

    if field.bit_count < 32 {
        value &= (1u32 << field.bit_count) - 1;
    }
    Ok(value)
}

/// ESP32 / ESP32-C2 / ESP8266 共用：通过 UART 时钟分频推算晶振是 26MHz 还是 40MHz。
///
/// `xtal_clk_divider`：UART 时钟相对晶振的分频（ESP8266 为 2，其余为 1）。
pub(crate) fn detect_xtal_via_uart_clkdiv(
    conn: &mut Connection,
    uart_clkdiv_reg: u32,
    xtal_clk_divider: u32,
) -> Result<u32> {
    const UART_CLKDIV_MASK: u32 = 0xFFFFF;
    let uart_div = conn.read_reg(uart_clkdiv_reg)? & UART_CLKDIV_MASK;
    let est_xtal =
        (conn.baud() as u64 * uart_div as u64) / 1_000_000 / xtal_clk_divider.max(1) as u64;
    Ok(if est_xtal > 33 { 40 } else { 26 })
}
