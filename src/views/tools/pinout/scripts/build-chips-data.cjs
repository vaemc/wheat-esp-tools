/**
 * Build the per-chip JSON files under ../chips-data/
 *
 * Inputs:
 *   - ./out/<chip>.json            extracted pin arrays (from extract.cjs)
 *   - ../data/pins.ts              [optional] ESP32-P4 v3 / v1 source data
 *                                  from the upstream XLSX generator. If the
 *                                  file is absent (the normal case after
 *                                  migration), the existing
 *                                  chips-data/esp32-p4.json is left alone.
 *   - The CHIP_META object below   per-chip metadata (CPU, datasheet URL, ...)
 *
 * Output:
 *   - ../chips-data/<chip>.json    full ChipDefinition object, ready to be
 *                                  loaded by `import.meta.glob` at runtime.
 *
 * Schema (matches src/views/tools/pinout/chips/types.ts):
 *
 *   {
 *     "id":             "esp32-p4",
 *     "name":           "ESP32-P4",
 *     "tagline":        "...",
 *     "cpu":            "...",
 *     "datasheetUrl":   "https://...",
 *     "verified":       true,
 *     "notes":          "...",
 *     "displayOrder":   10,                ← lower comes first in the picker
 *     "defaultVariant": "v3",
 *     "variants": [
 *       {
 *         "id":     "v3",
 *         "label":  "v3.x",
 *         "layout": {
 *           "type":        "QFN",
 *           "pinCount":    104,
 *           "pinsPerSide": 26,
 *           "centerPin":   105,
 *           "packageName": "QFN-104+1"
 *         },
 *         "pins": [ { number, name, type, supply, resetAt, resetAfter,
 *                     iomux: [...], lpio: [...], analog: [...] }, ... ]
 *       }
 *     ]
 *   }
 *
 * Run:
 *   node scripts/build-chips-data.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(__dirname, "out");
const CHIPS_DATA_DIR = path.join(ROOT, "chips-data");

/* --------------------------------------------------------------------- */
/*  QFN layout helper (same logic as chips/layout.ts:makeQfn)             */
/* --------------------------------------------------------------------- */
function makeQfn(pinCount, centerPin = null) {
  if (pinCount % 4 !== 0) {
    throw new Error(`QFN pin count must be divisible by 4 (got ${pinCount})`);
  }
  return {
    type: "QFN",
    pinCount,
    pinsPerSide: pinCount / 4,
    centerPin,
    packageName: `QFN-${pinCount}${centerPin != null ? "+1" : ""}`,
  };
}

/* --------------------------------------------------------------------- */
/*  Strapping (boot-mode) pins                                            */
/* --------------------------------------------------------------------- *
 *
 * Sampled by hardware right after a reset, these GPIOs select the boot
 * mode, VDD_SPI voltage, ROM-message verbosity, JTAG signal source, etc.
 * They must be left in a known valid state for tens of milliseconds after
 * CHIP_PU goes high — when used as regular IO, an external pull-up or
 * pull-down might be required.
 *
 * Sources (per-chip):
 *   ESP32     :  datasheet v5.2, §3 "Strapping & Configuration"
 *   ESP32-S3  :  datasheet v1.7, §2.4 "Strapping Pins"
 *   ESP32-C3  :  datasheet v1.7, §2.5 "Strapping Pins"
 *   ESP32-C6  :  datasheet v1.4, §2.6 "Strapping Pins"
 *   ESP32-C5  :  datasheet rev0.4, §2.6 "Strapping Pins"
 *   ESP32-P4  :  datasheet rev1.0, §2.5 "Strapping Pins"
 *
 * Keys are GPIO numbers (matched against the pin name "GPIOn" or the
 * registered alias).
 */
const STRAPPING = {
  esp32: {
    0: { default: 1, purpose: "启动模式选择 (与 GPIO2 共同决定 SPI Boot / 下载模式)" },
    2: { default: 0, purpose: "启动模式选择 (与 GPIO0 共同决定下载方式)" },
    12: { default: 0, purpose: "VDD_SDIO 电压选择 (MTDI: 0=3.3V / 1=1.8V)" },
    15: { default: 1, purpose: "U0TXD 启动日志使能 (MTDO: 0=静默 / 1=输出)" },
    5: { default: 1, purpose: "SDIO 时序选择 (与 MTDO 配合)" },
  },
  "esp32-s3": {
    0: { default: 1, purpose: "启动模式选择 (1=SPI Flash Boot / 0=下载模式)" },
    3: { purpose: "启动 ROM Log 输出口选择 (USB-Serial-JTAG / UART)" },
    45: { default: 0, purpose: "VDD_SPI 电压选择 (0=3.3V / 1=1.8V)" },
    46: { default: 0, purpose: "ROM 启动日志使能 (0=正常输出 / 1=静默)" },
  },
  "esp32-c3": {
    2: { default: 1, purpose: "启动模式选择 (1=SPI Flash Boot / 0=Joint Download)" },
    8: { default: 1, purpose: "ROM 启动日志使能 (1=输出 / 0=静默)" },
    9: { default: 1, purpose: "启动模式选择 (与 GPIO2 一起决定下载方式)" },
  },
  "esp32-c6": {
    4: { purpose: "JTAG 信号源选择" },
    5: { purpose: "下载模式日志输出选择" },
    8: { default: 1, purpose: "ROM 启动日志使能 (1=输出 / 0=静默)" },
    9: { default: 1, purpose: "启动模式选择 (1=SPI Flash Boot / 0=下载模式)" },
    15: { purpose: "JTAG 信号源选择 (USB-Serial-JTAG / 普通 JTAG)" },
  },
  "esp32-c5": {
    2: { purpose: "ROM 启动日志使能" },
    7: { purpose: "VDD_SPI 电压选择" },
    8: { default: 1, purpose: "启动模式选择 (1=SPI Flash Boot / 0=下载模式)" },
    27: { purpose: "JTAG 信号源选择" },
    28: { purpose: "芯片测试模式 (出厂校准)" },
  },
  "esp32-p4": {
    34: { purpose: "VDD_SPI 电压选择" },
    35: { default: 1, purpose: "启动模式选择 (1=SPI Flash Boot / 0=下载模式)" },
    36: { purpose: "ROM 启动日志使能" },
    37: { purpose: "JTAG 信号源选择 (USB-Serial-JTAG / 普通 JTAG)" },
    45: { purpose: "Boot 配置位" },
  },
};

/**
 * Derive a pin's GPIO number from its data — robust across chips that use
 * different pad-name conventions (XTAL_32K_P is GPIO0 on C6/C5 but GPIO15
 * on S3, MTDI is GPIO12 on ESP32 but GPIO41 on S3, etc).
 *
 *   1. If the pin's own name is "GPIOn", that's the answer.
 *   2. Otherwise look through the iomux function list and pick the first
 *      "GPIOn" entry — by Espressif convention, every IO MUX row contains
 *      its own GPIO number in one of the alt-function columns.
 *   3. If no GPIOn appears in the iomux list, the pin is dedicated
 *      (Power / Analog) and has no GPIO number.
 */
function pinToGpio(pin) {
  if (!pin || !pin.name) return null;
  const m = /^GPIO(\d+)$/.exec(pin.name);
  if (m) return parseInt(m[1], 10);
  if (Array.isArray(pin.iomux)) {
    for (const f of pin.iomux) {
      const fm = /^GPIO(\d+)$/.exec(f && f.name);
      if (fm) return parseInt(fm[1], 10);
    }
  }
  return null;
}

function applyStrapping(chipId, pins) {
  const map = STRAPPING[chipId];
  if (!map) return 0;
  let count = 0;
  for (const pin of pins) {
    const gpio = pinToGpio(pin);
    if (gpio == null) continue;
    const info = map[gpio];
    if (!info) continue;
    pin.strapping = { ...info };
    count++;
  }
  return count;
}

/* --------------------------------------------------------------------- */
/*  Per-chip metadata                                                     */
/* --------------------------------------------------------------------- */
const CHIP_META = {
  "esp32-p4": {
    name: "ESP32-P4",
    tagline: "高性能 RISC-V 双核 + LP 单核 — 多媒体应用处理器",
    cpu: "RISC-V 双核 (HP) + RISC-V LP",
    datasheetUrl:
      "https://www.espressif.com/sites/default/files/documentation/esp32-p4_datasheet_en.pdf",
    notes:
      "ESP32-P4 不带 Wi-Fi/BT，专注高性能本地处理。QFN-104+1 中央散热焊盘。",
    displayOrder: 10,
    defaultVariant: "v3",
    variants: [
      { id: "v3", label: "v3.x", layout: makeQfn(104, 105) },
      { id: "v1", label: "v1.x", layout: makeQfn(104, 105) },
    ],
  },
  "esp32-s3": {
    name: "ESP32-S3",
    tagline: "Xtensa Dual-Core, AI/ML 向量加速 + Wi-Fi 4 + BLE 5",
    cpu: "Xtensa LX7 (双核, AI 扩展)",
    datasheetUrl:
      "https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf",
    notes: "ESP32-S3 内置 USB-OTG 与 Camera/LCD 接口，56-pin QFN 封装。",
    displayOrder: 20,
    defaultVariant: "default",
    variants: [
      { id: "default", label: "QFN-56 (7×7 mm)", layout: makeQfn(56, 57) },
    ],
  },
  esp32: {
    name: "ESP32",
    tagline: "Xtensa Dual-Core, Wi-Fi 4 + Bluetooth Classic/LE",
    cpu: "Xtensa LX6 (双核)",
    datasheetUrl:
      "https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf",
    notes:
      "原始 ESP32 系列，48-pin QFN 封装。引脚数据基于 Espressif 官方 “ESP32 Pin List v2.0”。",
    displayOrder: 30,
    defaultVariant: "default",
    variants: [
      { id: "default", label: "QFN-48 (6×6 mm)", layout: makeQfn(48) },
    ],
  },
  "esp32-c3": {
    name: "ESP32-C3",
    tagline: "RISC-V 单核，低成本 Wi-Fi 4 + BLE 5",
    cpu: "RISC-V 32-bit (单核)",
    datasheetUrl:
      "https://www.espressif.com/sites/default/files/documentation/esp32-c3_datasheet_en.pdf",
    notes:
      "ESP32-C3 是 ESP32 家族首款 RISC-V 芯片，32-pin QFN 封装，22 个 GPIO。",
    displayOrder: 40,
    defaultVariant: "default",
    variants: [
      { id: "default", label: "QFN-32 (5×5 mm)", layout: makeQfn(32, 33) },
    ],
  },
  "esp32-c6": {
    name: "ESP32-C6",
    tagline: "RISC-V + LP RISC-V，Wi-Fi 6 + BLE 5 + Thread/Zigbee",
    cpu: "RISC-V 32-bit + LP 协处理器",
    datasheetUrl:
      "https://www.espressif.com/sites/default/files/documentation/esp32-c6_datasheet_en.pdf",
    notes:
      "ESP32-C6 同时支持 Wi-Fi 6 与 Thread/Zigbee。当前展示 QFN-40 封装的 30 个 IO。",
    displayOrder: 50,
    defaultVariant: "qfn40",
    variants: [
      { id: "qfn40", label: "QFN-40 (5×5 mm)", layout: makeQfn(40, 41) },
    ],
  },
  "esp32-c5": {
    name: "ESP32-C5",
    tagline: "双频 Wi-Fi 6 (2.4 + 5 GHz) + BLE 5 + 802.15.4",
    cpu: "RISC-V 32-bit",
    datasheetUrl:
      "https://www.espressif.com/sites/default/files/documentation/esp32-c5_datasheet_en.pdf",
    notes:
      "ESP32-C5 是 Espressif 首款支持双频 Wi-Fi 6 的 SoC，QFN-40 封装。",
    displayOrder: 60,
    defaultVariant: "default",
    variants: [
      { id: "default", label: "QFN-40 (5×5 mm)", layout: makeQfn(40, 41) },
    ],
  },
};

/* --------------------------------------------------------------------- */
/*  Read pin data                                                         */
/* --------------------------------------------------------------------- */

function readPinsFromOut(chipId) {
  const file = path.join(OUT_DIR, chipId + ".json");
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}. Run scripts/extract.cjs first.`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * Parse data/pins.ts to extract { v3: [...], v1: [...] }.
 *
 * The file is generated, so it has a predictable shape:
 *   export const PINS: ChipVersionData = { ...JSON-like... } as const;
 */
function readP4PinsFromTs() {
  const file = path.join(ROOT, "data", "pins.ts");
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");
  const m = text.match(/export\s+const\s+PINS\s*:\s*ChipVersionData\s*=\s*([\s\S]*?)\s*as\s+const\s*;\s*$/);
  if (!m) {
    throw new Error("Could not parse data/pins.ts — unexpected format");
  }
  // The captured group is a JSON object literal; safe to JSON.parse since
  // the generator (scripts/generate-pins.cjs in upstream esp-pinout) used
  // JSON.stringify to produce it.
  return JSON.parse(m[1]);
}

/* --------------------------------------------------------------------- */
/*  Build & emit                                                          */
/* --------------------------------------------------------------------- */

function buildEsp32P4() {
  const meta = CHIP_META["esp32-p4"];
  const data = readP4PinsFromTs();
  if (!data) {
    // Source TS gone — chips-data/esp32-p4.json is now the canonical source.
    // We still need to refresh strapping data on the existing JSON so newer
    // STRAPPING values flow through.  Read, patch, write back.
    return refreshStrappingInPlace("esp32-p4");
  }
  const variants = meta.variants.map((v) => {
    const pins = data[v.id] || [];
    applyStrapping("esp32-p4", pins);
    return { id: v.id, label: v.label, layout: v.layout, pins };
  });
  return {
    id: "esp32-p4",
    name: meta.name,
    tagline: meta.tagline,
    cpu: meta.cpu,
    defaultVariant: meta.defaultVariant,
    variants,
    datasheetUrl: meta.datasheetUrl,
    verified: true,
    notes: meta.notes,
    displayOrder: meta.displayOrder,
  };
}

/**
 * When a chip's source data isn't available anymore (e.g. ESP32-P4 after the
 * TS source was deleted), we still want STRAPPING updates to flow through
 * to chips-data/<chip>.json.  This re-reads the existing JSON, refreshes
 * the strapping fields and returns the updated definition for re-emit.
 */
function refreshStrappingInPlace(chipId) {
  const file = path.join(CHIPS_DATA_DIR, chipId + ".json");
  if (!fs.existsSync(file)) return null;
  const def = JSON.parse(fs.readFileSync(file, "utf8"));
  let touched = 0;
  for (const v of def.variants) {
    // Drop any stale strapping first, so we never leave behind data for a
    // GPIO that's since been removed from STRAPPING.
    for (const p of v.pins) delete p.strapping;
    touched += applyStrapping(chipId, v.pins);
  }
  console.log(`  refreshed strapping on ${touched} pins of ${chipId}`);
  return def;
}

function buildSimpleChip(chipId) {
  const meta = CHIP_META[chipId];
  if (!meta) throw new Error(`No metadata for ${chipId}`);
  const pins = readPinsFromOut(chipId);
  applyStrapping(chipId, pins);
  const variants = meta.variants.map((v) => ({
    id: v.id,
    label: v.label,
    layout: v.layout,
    pins,
  }));
  return {
    id: chipId,
    name: meta.name,
    tagline: meta.tagline,
    cpu: meta.cpu,
    defaultVariant: meta.defaultVariant,
    variants,
    datasheetUrl: meta.datasheetUrl,
    verified: true,
    notes: meta.notes,
    displayOrder: meta.displayOrder,
  };
}

function summarize(chip) {
  const v0 = chip.variants[0];
  return {
    id: chip.id,
    name: chip.name,
    variants: chip.variants.length,
    layout: v0.layout.packageName,
    pins: v0.pins.length,
    iomux: v0.pins.filter((p) => p.iomux && p.iomux.length).length,
    lpio: v0.pins.filter((p) => p.lpio && p.lpio.length).length,
    analog: v0.pins.filter((p) => p.analog && p.analog.length).length,
    strapping: v0.pins.filter((p) => p.strapping).length,
  };
}

function emitChip(chip) {
  fs.mkdirSync(CHIPS_DATA_DIR, { recursive: true });
  const file = path.join(CHIPS_DATA_DIR, chip.id + ".json");
  fs.writeFileSync(file, JSON.stringify(chip, null, 2) + "\n", "utf8");
  return file;
}

const chips = [
  buildEsp32P4(),
  buildSimpleChip("esp32-s3"),
  buildSimpleChip("esp32"),
  buildSimpleChip("esp32-c3"),
  buildSimpleChip("esp32-c6"),
  buildSimpleChip("esp32-c5"),
].filter(Boolean);

const summaries = [];
for (const chip of chips) {
  const file = emitChip(chip);
  summaries.push(summarize(chip));
  console.log("wrote", file);
}
if (!chips.find((c) => c.id === "esp32-p4")) {
  console.log(
    "skipped esp32-p4 (no source data/pins.ts; chips-data/esp32-p4.json is canonical)",
  );
}

console.log("\nSummary:");
console.table(summaries);
