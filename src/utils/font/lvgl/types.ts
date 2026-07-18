/** 输出格式：C 数组 / 二进制 / 两者都生成 */
export type LvglFontFormat = "lvgl" | "bin" | "both";

/** bpp：每像素位数（抗锯齿），3 需开启压缩 */
export type LvglFontBpp = 1 | 2 | 3 | 4 | 8;

/** LVGL 字体转换参数（对齐 lv_font_conv / 在线 Font Converter） */
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
  /** 启用内置 RLE 压缩（体积更小，渲染稍慢）；bpp=3 时必须开启 */
  compress: boolean;
  /** 水平子像素渲染（--lcd），画质更好但体积更大 */
  lcd: boolean;
  /** 垂直子像素渲染（--lcd-v） */
  lcdV: boolean;
  /**
   * 尝试使用字体中的字形颜色信息生成灰度图标
   *（灰度靠透明度模拟，适合对比鲜明的背景）
   */
  useColorInfo: boolean;
  /** 丢弃字距调整信息以减小体积（一般不推荐） */
  noKerning: boolean;
  /** 回退字体 C 符号名，如 `lv_font_montserrat_14`；空则不设置 */
  fallback: string;
  /** `--format lvgl` 时 `lvgl.h` 的包含路径；空则用默认 */
  lvInclude: string;
}

export interface LvglFontConvertResult {
  fontName: string;
  size: number;
  bpp: number;
  /** C 源文件内容（format 含 lvgl 时有值） */
  cSource?: string;
  /** 二进制字体数据（format 含 bin 时有值） */
  binBytes?: Uint8Array;
}

export const DEFAULT_LVGL_FONT_OPTIONS: LvglFontConvertOptions = {
  fontName: "font_16",
  size: 16,
  bpp: 4,
  format: "both",
  range: "0x20-0x7F",
  symbols: "",
  compress: true,
  lcd: false,
  lcdV: false,
  useColorInfo: false,
  noKerning: false,
  fallback: "",
  lvInclude: "",
};

/** 常用 Unicode 范围预设 */
export const RANGE_PRESETS: { key: string; range: string }[] = [
  { key: "ascii", range: "0x20-0x7F" },
  { key: "latin1", range: "0x20-0xFF" },
  { key: "digits", range: "0x30-0x39" },
  { key: "cjkBasic", range: "0x4E00-0x9FA5" },
  {
    key: "fontAwesome",
    range:
      "61441,61448,61451,61452,61453,61457,61459,61461,61465,61468,61473,61478,61479,61480,61502,61512,61515,61516,61517,61521,61522,61523,61524,61543,61544,61550,61552,61553,61556,61559,61560,61561,61563,61587,61589,61636,61637,61639,61671,61674,61683,61724,61732,61787,61931,62016,62017,62018,62019,62020,62087,62099,62212,62189,62810,63426,63650",
  },
];
