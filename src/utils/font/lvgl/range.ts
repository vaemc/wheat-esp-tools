import type { LvglFontConvertOptions } from "./types";

/**
 * 将 UI 中的 range 字符串解析为 lv_font_conv 需要的三元组数组：
 * [start, end, remapStart, ...]
 *
 * 支持：`0x20-0x7F`、`65-90`、`0x1F450=>0xF005`、`0x20-0x7F=>0x20`、逗号分隔。
 */
export function parseUnicodeRange(input: string): number[] {
  const raw = input.trim();
  if (!raw) {
    return [];
  }
  const out: number[] = [];
  for (const part of raw.split(/[,;\s]+/).filter(Boolean)) {
    const mapped = part.split("=>");
    const span = mapped[0]!.trim();
    const remapRaw = mapped[1]?.trim();
    const dash = span.split("-");
    const start = parseCodePoint(dash[0]!.trim());
    const end = dash[1] ? parseCodePoint(dash[1].trim()) : start;
    const remap = remapRaw ? parseCodePoint(remapRaw) : start;
    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      Number.isNaN(remap) ||
      start < 0 ||
      end < start
    ) {
      throw new Error(`INVALID_RANGE:${part}`);
    }
    out.push(start, end, remap);
  }
  return out;
}

function parseCodePoint(text: string): number {
  const t = text.trim().toLowerCase();
  if (t.startsWith("0x")) {
    return Number.parseInt(t.slice(2), 16);
  }
  return Number.parseInt(t, 10);
}

/** 生成与官方在线工具类似的 opts 注释字符串 */
export function buildOptsString(
  options: LvglFontConvertOptions,
  fontFileName: string
): string {
  const parts: string[] = [
    "--bpp",
    String(options.bpp),
    "--size",
    String(options.size),
  ];
  if (!options.compress) {
    parts.push("--no-compress");
  }
  if (options.lcd) {
    parts.push("--lcd");
  }
  if (options.lcdV) {
    parts.push("--lcd-v");
  }
  if (options.useColorInfo) {
    parts.push("--use-color-info");
  }
  if (options.noKerning) {
    parts.push("--no-kerning");
  }
  parts.push("--font", fontFileName);
  if (options.range.trim()) {
    parts.push("--range", options.range.trim());
  }
  if (options.symbols) {
    parts.push("--symbols", options.symbols);
  }
  parts.push("--format", options.format === "both" ? "lvgl" : options.format);
  parts.push("-o", `${options.fontName}.c`);
  return parts.join(" ");
}

/** 规范化 C/文件安全的字体名 */
export function sanitizeFontName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!cleaned) {
    return "font";
  }
  if (/^[0-9]/.test(cleaned)) {
    return `font_${cleaned}`;
  }
  return cleaned;
}
