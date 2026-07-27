# wheat-esptool

为 **wheat-esp-tools** 定制的 ESP 串口烧录协议库。功能从
[espressif/esptool](https://github.com/espressif/esptool) 移植（协议、时序、寄存器表与
esptool / espflash 保持一致），接口按本项目的交互需求设计：**字节级进度事件、
结构化错误码、可插拔的芯片定义**。

不依赖 espflash；唯一的二进制资产是 Espressif 官方 flasher stub（`stubs/*.toml`，
MIT/Apache-2.0 双许可，来自 [esp-flasher-stub](https://github.com/esp-rs/esp-flasher-stub)，
与 esptool 使用的 stub 同源）。

## 功能总览

| 能力 | 实现方式 |
| --- | --- |
| 自动复位进 bootloader | Classic DTR/RTS、UnixTight、USB-Serial-JTAG 三种时序自动轮换 |
| 芯片识别 | 优先 `GET_SECURITY_INFO` 的 chip_id，回落 `0x40001000` magic 寄存器 |
| stub 加载 | `MEM_BEGIN/DATA/END` + `OHAI` 握手 |
| 烧录 | `FLASH_DEFL_*`（zlib 压缩）+ 可选 MD5 校验；ROM 模式回落非压缩 `FLASH_*` |
| 读取 | stub `READ_FLASH` 流式读取（滑动窗口 ACK + 全量 MD5 校验），边收边写文件 |
| 擦除 | `ERASE_FLASH`（整片）/ `ERASE_REGION`（区域） |
| 设备信息 | 芯片版本 / MAC / 晶振 / 特性（eFuse）/ Flash 容量（SPI RDID）/ 安全信息 |
| 波特率切换 | `CHANGE_BAUDRATE`（连接固定 115200，成功后提速） |
| 停止操作 | `CancelToken` 协作式取消（写入逐块 / 读取逐包边界响应，见下方说明） |

已支持芯片（对齐 esptool master `targets/` 全部 15 款）：

| 芯片 | 识别方式 | stub |
| --- | --- | --- |
| ESP32 | magic | ✔ |
| ESP32-C2 / C3 / C5 / C6 / H2 / S3 | chip_id + magic | ✔ |
| ESP32-S2 | chip_id + magic | ✔ |
| ESP32-P4 | chip_id + magic | ✔（RC1 版本自动选旧 stub） |
| ESP32-C61 / H4 / S31 | chip_id | ✔ |
| ESP32-H21 / E22 | chip_id | ✘（官方未发布，自动回落 ROM loader） |
| ESP8266 | magic `0xFFF0C101` | ✔ |

无 stub 的芯片（H21 / E22）连接后以 ROM loader 运行：写入（非压缩）、擦除、
设备信息可用；`READ_FLASH` 流式读取不可用（返回 `unsupported:read_flash_requires_stub`）。

## 模块结构

```
src/
├── lib.rs          # 公开导出
├── error.rs        # Error 枚举；Display 输出为机器可读的 `code:detail` 错误码
├── slip.rs         # SLIP 帧编解码（增量解码器，支持一次读取带回多帧）
├── command.rs      # 命令码 / 超时策略 / 请求包构造（build_request / data_payload / le32）
├── reset.rs        # 复位策略（ResetBefore / ResetAfter + 各时序实现）
├── connection.rs   # 串口连接：begin(复位+同步) / command / read_reg / SecurityInfo
├── stub.rs         # stub TOML 解析（entry + base64 的 text/data 段）
├── progress.rs     # ProgressEvent / ProgressSink（进度回调协议）
├── flasher.rs      # 高层 Flasher：connect / write_flash / read_flash / erase / device_info
└── chips/
    ├── mod.rs      # ChipDefinition trait + CHIPS 注册表 + read_efuse 通用实现
    ├── esp32.rs    # 每芯片一个文件（差异点全部集中在这里）
    ├── esp32c2.rs / esp32c3.rs / esp32c5.rs / esp32c6.rs / esp32c61.rs
    ├── esp32e22.rs / esp32h2.rs / esp32h21.rs / esp32h4.rs / esp32p4.rs
    ├── esp32s2.rs / esp32s3.rs / esp32s31.rs / esp8266.rs
stubs/              # 官方 flasher stub（TOML，include_str! 编译期内嵌）
```

## 快速上手

```rust
use wheat_esptool::{ConnectConfig, Flasher, NoProgress, ProgressEvent, ProgressSink,
                    ResetAfter, ResetBefore, Segment};

// 1. 实现进度回调（或用 NoProgress 忽略）
struct Printer;
impl ProgressSink for Printer {
    fn event(&mut self, ev: ProgressEvent) {
        if let ProgressEvent::WriteProgress { written_bytes, total_bytes, .. } = ev {
            println!("{written_bytes}/{total_bytes}");
        }
    }
}

// 2. 连接（复位 → 同步 → 识别芯片 → 加载 stub → 探测 Flash → 切波特率）
let cfg = ConnectConfig {
    port: "COM5".into(),
    baud: 921_600,                    // 目标波特率；握手固定 115200
    before: ResetBefore::DefaultReset,
    after: ResetAfter::HardReset,
    use_stub: true,                   // 读取 / 整片擦除必须 stub
};
let mut sink = Printer;
let mut flasher = Flasher::connect(&cfg, &mut sink)?;

println!("{} rev={:?} flash={:?}",
    flasher.chip_name(), flasher.revision(), flasher.flash_size_bytes());

// 3. 烧录（多段，zlib 压缩传输，verify=true 时逐段 MD5 校验）
flasher.write_flash(
    &[Segment { addr: 0x10000, data: std::fs::read("app.bin")? }],
    /* verify */ true,
    &mut sink,
)?;

// 4. 读取（流式写入任意 Write，自动 MD5 校验）
let mut out = std::io::BufWriter::new(std::fs::File::create("dump.bin")?);
flasher.read_flash(0x0, 0x400000, &mut out, &mut sink)?;

// 5. 擦除 / 设备信息
flasher.erase_region(0x9000, 0x6000)?;
let info = flasher.device_info()?;          // 芯片/版本/MAC/晶振/特性/容量
let sec  = flasher.security_info()?;        // ESP32 返回 Ok(None)

// 6. 收尾：按 cfg.after 复位（每次操作成功后调用一次）
flasher.finish()?;
```

## 公开 API 参考

### `flasher::ConnectConfig`

| 字段 | 说明 |
| --- | --- |
| `port` | 串口名（`COM5` / `/dev/ttyUSB0`） |
| `baud` | 目标波特率；`> 115200` 时连接成功后经 `CHANGE_BAUDRATE` 切换 |
| `before` | `ResetBefore::{DefaultReset, NoReset, NoResetNoSync, UsbReset}` |
| `after` | `ResetAfter::{HardReset, NoReset, NoResetNoStub}` |
| `use_stub` | 是否加载 stub（本项目固定 `true`） |

### `flasher::Flasher`

| 方法 | 说明 |
| --- | --- |
| `connect(&ConnectConfig, &mut dyn ProgressSink) -> Result<Flasher>` | 建立连接（见下方时序） |
| `chip_name() -> &'static str` | 如 `"ESP32-S3"` |
| `revision() -> Option<(u32, u32)>` | 芯片版本 (major, minor) |
| `flash_size_bytes() -> Option<u32>` | 连接时经 SPI RDID 探测的容量 |
| `stub_active() / secure_download_mode()` | 状态查询 |
| `write_flash(&[Segment], verify, sink)` | 多段烧录；内部逐段发事件 |
| `read_flash(offset, size, &mut dyn Write, sink)` | 流式读取 + MD5 校验（需 stub） |
| `erase_flash(sink)` / `erase_region(offset, size)` | 擦除（需 stub；区域需 4KB 对齐） |
| `md5_region(addr, size) -> [u8; 16]` | 设备端 MD5 |
| `device_info() -> DeviceInfo` | 汇总信息（读 eFuse，稍慢） |
| `security_info() -> Option<SecurityInfo>` | 安全信息；ESP32 不支持返回 `None` |
| `set_cancel_token(CancelToken)` | 注入取消令牌（见下方「停止操作」） |
| `finish()` | 补发 `FLASH(_DEFL)_END` 并按 `after` 复位；**成功路径必须调用** |
| `abort()` | 取消/失败后的清理：放弃写序列，直接按 `after` 复位 |

### `cancel::CancelToken`（停止操作）

```rust
let token = CancelToken::new();
flasher.set_cancel_token(token.clone());
// 另一线程：token.cancel();
// → write_flash / read_flash 在下一个包边界返回 Error::Cancelled（Display = "cancelled"）
```

- 检查点在**包边界**：写入逐块（16KB）、读取逐包（4KB）、多段之间，
  停止延迟通常 < 1 秒；
- **正在执行中的单条命令无法中断**——整片/区域擦除一旦下发，芯片自行完成，
  取消只在下发前生效；
- 取消后调用 `abort()` 复位设备，避免停留在 bootloader。

### `progress::ProgressEvent`（全部携带字节级数据）

```
OpeningPort { port }                          打开串口
Connecting { use_stub }                       复位 + 同步中
ChipDetected { chip, revision }               识别完成
StubReady / BaudChanged { baud } / FlashDetected { size_bytes }
EraseAllStart / EraseAllDone                  整片擦除（write_flash 前置擦除也走这里）
SegmentStart { index, count, addr, total_bytes, transfer_bytes, blocks }
WriteProgress { addr, written_bytes, total_bytes }   ← 解压后真实字节，单调递增
Verifying { addr }
SegmentDone { addr, skipped }
ReadStart / ReadProgress { addr, read_bytes, total_bytes } / ReadDone
```

`written_bytes` 通过对压缩流做本地解压计数得到，与设备端实际写入的字节一一对应，
可直接换算百分比 / 速度 / ETA。

### `error::Error`（Display = 前端可解析的错误码）

| 错误码前缀 | 含义 | 重试建议 |
| --- | --- | --- |
| `open_port_failed:`* | 串口打开失败（由上层包装 `Error::Serial`） | 否 |
| `connect_failed:` | 复位 + 同步失败（`no_sync_reply` / `wrong_boot_mode:...`） | 换按键进 boot |
| `command_timeout:` / `serial_timeout:` | 命令超时 | 读操作可降速重试 |
| `rom_error:CMD:0xNN:name` | ROM / stub 返回错误状态 | 视命令而定 |
| `read_corrupt:` | 读取丢包 / MD5 不符 | **降速重试** |
| `verify_failed:` | 烧录后校验失败 | 检查 Flash |
| `flash_size_unknown:` | RDID 无法识别容量 | 手动指定大小 |
| `chip_detect_failed:` | 芯片无法识别 | 见下方「新增芯片」 |
| `cancelled` | 用户经 `CancelToken` 主动停止 | 否（非失败） |

`Error::is_retryable_read()` 与上层 `is_retryable_read_error()`（字符串版）都可判断
是否值得降速重试。

## 连接时序（`Flasher::connect` 内部流程）

1. 打开串口（115200，8N1，无流控）
2. `begin()`：按策略序列复位（Windows: Classic×2；Unix: UnixTight×2 + Classic×2；
   USB-Serial-JTAG PID `0x1001` 自动改用专用时序），每次复位后最多 5 次 SYNC
3. 芯片识别：`GET_SECURITY_INFO`（同时拿到 Secure-Download-Mode 标志与 chip_id）
   → 失败回落 `READ_REG 0x40001000` magic 匹配
4. 读芯片版本（eFuse）→ `ChipDefinition::post_connect()` 钩子（如 P4 Flash 上电）
5. `use_stub` 时加载 stub（加载后响应 status 从 4 字节变 2 字节，库内自动处理）
6. `SPI_ATTACH`（默认引脚 → ESP32-PICO-D4 引脚）+ RDID 探测容量 + `SPI_SET_PARAMS`
7. `baud > 115200` 时 `CHANGE_BAUDRATE`

## ★ 新增芯片指南（给后续维护者 / AI）

以 **ESP32-C61** 为例（已实现，完整代码见 `src/chips/esp32c61.rs`），四步完成接入：

### 第 1 步：收集芯片数据

到 esptool 源码 `esptool/targets/esp32c61.py`（或 espflash `src/target/`）查：

| 需要的数据 | esptool 中的位置 |
| --- | --- |
| chip_id | `IMAGE_CHIP_ID`（C61 = 20） |
| magic 值 | `CHIP_DETECT_MAGIC_VALUE`（可能多个，对应不同 ECO） |
| eFuse 块读地址 | `EFUSE_BASE` + mem_definition（block0 读地址一般是 base+0x2C，后续块看表） |
| MAC / 版本字段 | `MAC0/MAC1`、`WAFER_VERSION_MAJOR/MINOR` 的 (block, bit_start, bit_count) |
| SPI 寄存器 | `SPI_REG_BASE` + `SPI_USR_OFFS` 等（多数新芯片可复用 `SPI_REGS_V2_0X60003000`） |
| 晶振 | 固定值（多数 40MHz）或检测逻辑 |
| 特性列表 | `get_chip_features()` |

### 第 2 步：放入 stub

stub 来源（任选其一，格式转换后放进本 crate 的 `stubs/` 目录）：

- esptool 仓库 `esptool/targets/stub_flasher/2/<chip>.json`（JSON，字段同名，
  `text`/`data` 为 base64；转成 TOML 即可，见 stubs 目录内现有文件的头注释）；
- espflash 仓库 `resources/stubs/<chip>.toml`（可直接使用）。

TOML 格式：`entry` / `text_start` / `text`(base64) / `data_start` / `data`(base64)。
官方尚未发布 stub 的芯片让 `stub_source()` 返回 `None`，库会自动以 ROM loader
运行（写入非压缩、无流式读取）。

### 第 3 步：新建芯片文件 `src/chips/esp32c61.rs`

```rust
use super::{read_efuse, ChipDefinition, EfuseField, SpiRegisters, SPI_REGS_V2_0X60003000};
use crate::connection::Connection;
use crate::error::Result;

pub struct Esp32c61;

// EFUSE_BASE = 0x600B4800；block0 读地址 +0x030，block1 +0x044
const EFUSE_BLOCKS: &[u32] = &[0x600B_4830, 0x600B_4844];
const MAC0: EfuseField = EfuseField::new(1, 0, 32);
const MAC1: EfuseField = EfuseField::new(1, 32, 16);
// bit_start 是「块内绝对 bit 偏移」= 字号×32 + 字内位移（esptool: word2 >>4 &0x3 → 68,2）
const WAFER_VERSION_MAJOR: EfuseField = EfuseField::new(1, 68, 2);
const WAFER_VERSION_MINOR: EfuseField = EfuseField::new(1, 64, 4);

impl ChipDefinition for Esp32c61 {
    fn name(&self) -> &'static str { "ESP32-C61" }
    fn chip_id(&self) -> Option<u16> { Some(20) }
    // 新芯片一般没有独立 magic（GET_SECURITY_INFO 的 chip_id 是首选识别途径）
    fn magic_values(&self) -> &'static [u32] { &[] }
    fn efuse_block_read_addrs(&self) -> &'static [u32] { EFUSE_BLOCKS }
    fn mac_fields(&self) -> (EfuseField, EfuseField) { (MAC0, MAC1) }
    fn spi_registers(&self) -> SpiRegisters { SPI_REGS_V2_0X60003000 }
    fn stub_source(&self, _rev: Option<(u32, u32)>) -> Option<&'static str> {
        Some(include_str!("../../stubs/esp32c61.toml"))
    }
    fn revision(&self, conn: &mut Connection) -> Result<(u32, u32)> {
        Ok((
            read_efuse(conn, self, WAFER_VERSION_MAJOR)?,
            read_efuse(conn, self, WAFER_VERSION_MINOR)?,
        ))
    }
    fn features(&self, _conn: &mut Connection) -> Result<Vec<String>> {
        Ok(vec!["WiFi 6".into(), "BT 5".into()])
    }
    // 可选覆盖：
    // fn xtal_mhz()          晶振非固定 40MHz 时（参考 esp32.rs / esp32c5.rs / esp8266.rs）
    // fn post_connect()      连接后的特殊准备（参考 esp32p4.rs 的 Flash 上电）
    // fn supports_get_security_info()  仅老芯片需要（ESP32 / ESP8266 = false）
    // fn stub_source(rev)    按硬件版本选 stub（参考 esp32p4.rs）；返回 None = ROM loader 运行
    // fn supports_spi_attach()         仅 ESP8266 = false（ROM 无 SPI_ATTACH 命令）
    // fn rom_flash_begin_has_encrypt_flag()  ESP32 / ESP8266 = false（ROM FLASH_BEGIN 只有 4 个参数字）
    // fn rom_erase_size(offset, size)  仅 ESP8266 需要（ROM 擦除 bug 折算，参考 esp8266.rs）
    // fn mac_address(conn)             无 eFuse 控制器的芯片直接读寄存器（参考 esp8266.rs）
}
```

### 第 4 步：注册

`src/chips/mod.rs` 里加两行：

```rust
mod esp32c61;                      // ① 模块声明
pub static CHIPS: &[&dyn ChipDefinition] = &[
    // ...
    &esp32c61::Esp32c61,           // ② 注册表追加
];
```

完成。识别（chip_id / magic）、stub 加载、烧录、读取、擦除、设备信息全部自动生效，
无需改动 `flasher.rs` / `connection.rs` / 上层 Tauri 命令。

**上层 UI 无需任何改动**：芯片名只是透传字符串；进度与错误协议与芯片无关。

## 与 wheat-esp-tools 的集成契约

上层适配代码在 `src-tauri/src/espflash_ops/`：

- `progress.rs` 的 `OpsSink` 把 `ProgressEvent` 翻译成前端事件
  `espflash_progress` / `espflash_log`（messageKey 由前端 `espflash.msg.*` i18n）；
- `connect.rs` 负责参数解析（`before`/`after`/`flash_mode`/偏移长度字符串）与错误码包装；
- 错误字符串按 `src/utils/espflash/events.ts` 的 `ESPFLASH_ERROR_KEYS` 映射为用户文案，
  新增错误码时在两边同步。

**修改本库时的注意点：**

1. `Error` 的 Display 格式是前端契约的一部分，改动前缀要同步前端映射表；
2. `ProgressEvent` 新增变体后，记得在 `OpsSink` 补处理分支（未处理会被 `match` 编译器拦下）；
3. 响应 status 长度（ROM=4 / stub=2）由 `Connection` 内部跟踪，
   任何在 stub 加载前后新增的命令不需要关心此差异；
4. `READ_MAX_IN_FLIGHT`（默认 64）越大读取越快，串口质量差时上层已有降速重试兜底；
5. stub TOML 是编译期内嵌的，更新 stub 后直接重新编译即可。

## 协议参考

- [esptool Serial Protocol 文档](https://docs.espressif.com/projects/esptool/en/latest/esp32/advanced-topics/serial-protocol.html)
- [espressif/esptool](https://github.com/espressif/esptool)（`esptool/loader.py`、`esptool/reset.py`、`esptool/targets/`）
- [esp-rs/esp-flasher-stub](https://github.com/esp-rs/esp-flasher-stub)（stub 源码）
