/** 输出格式：当前快速转换仅支持 C 数组 */
export type LvglFontFormat = "lvgl";

/** bpp：每像素位数（抗锯齿） */
export type LvglFontBpp = 1 | 2 | 4 | 8;

/** 与 UI / Rust 一致的字号范围 */
export const LVGL_FONT_SIZE_MIN = 4;
export const LVGL_FONT_SIZE_MAX = 256;

/** 单段 Unicode 跨度上限（防止 0x0-0xfffff 一类自杀范围） */
export const LVGL_MAX_RANGE_SPAN = 300_000;

/** LVGL 字体转换参数（快速 Rust 转换器） */
export interface LvglFontConvertOptions {
  /** 输出字体名，如 arial_16；用于 C 变量名与文件名 */
  fontName: string;
  /** 字号（像素高度） */
  size: number;
  /** 每像素位数 */
  bpp: LvglFontBpp;
  /** 输出格式 */
  format: LvglFontFormat;
  /**
   * Unicode 范围，逗号分隔。
   * 例：`0x20-0x7F`、`0x4E00-0x9FA5`、`61441,61448`
   */
  range: string;
  /**
   * 直接列出要包含的字符（可与 range 同时使用）。
   * 例：`0123456789.,:℃`
   */
  symbols: string;
  /** 回退字体 C 符号名，如 `lv_font_montserrat_14`；空则不设置 */
  fallback: string;
  /** `lvgl.h` 的包含路径；空则用默认 */
  lvInclude: string;
}

export interface LvglFontConvertResult {
  fontName: string;
  size: number;
  bpp: number;
  /** C 源文件内容 */
  cSource?: string;
  /** 实际转换的字形数 */
  glyphCount?: number;
  /** 耗时毫秒 */
  elapsedMs?: number;
}

export interface LvglFontProgressEvent {
  jobId: string;
  stage: string;
  current: number;
  total: number;
  percent: number;
  message: string;
}

export const DEFAULT_LVGL_FONT_OPTIONS: LvglFontConvertOptions = {
  fontName: "font_16_4",
  size: 16,
  bpp: 4,
  format: "lvgl",
  range: "0x20-0x7F",
  symbols: "",
  fallback: "",
  lvInclude: "",
};

/** 常用 Unicode 范围预设（避免超大跨度导致内存暴涨） */
export const RANGE_PRESETS: { key: string; range: string }[] = [
  { key: "ascii", range: "0x20-0x7F" },
  { key: "latin1", range: "0x20-0xFF" },
  { key: "digits", range: "0x30-0x39" },
  { key: "cjkBasic", range: "0x4E00-0x9FA5" },
  { key: "cjkBasicAscii", range: "0x20-0x7F,0x4E00-0x9FA5" },
  {
    key: "fontAwesome",
    range:
      "61441,61448,61451,61452,61453,61457,61459,61461,61465,61468,61473,61478,61479,61480,61502,61512,61515,61516,61517,61521,61522,61523,61524,61543,61544,61550,61552,61553,61556,61559,61560,61561,61563,61587,61589,61636,61637,61639,61671,61674,61683,61724,61732,61787,61931,62016,62017,62018,62019,62020,62087,62099,62212,62189,62810,63426,63650",
  },
];
