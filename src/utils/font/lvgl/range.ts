/**
 * 校验 UI 中的 range 字符串语法（与 Rust `parse_unicode_ranges` 对齐）。
 * 支持：`0x20-0x7F`、`65-90`、`0x1F450=>0xF005`、`0x20-0x7F=>0x20`、逗号分隔。
 * 出现 `=>` 时 remap 必须非空。
 */
export function parseUnicodeRange(input: string): void {
  const raw = input.trim();
  if (!raw) {
    return;
  }
  for (const part of raw.split(/[,;\s]+/).filter(Boolean)) {
    const mapped = part.split("=>");
    const span = mapped[0]!.trim();
    const hasRemap = mapped.length > 1;
    const remapRaw = mapped[1]?.trim() ?? "";
    if (!span || (hasRemap && !remapRaw)) {
      throw new Error(`INVALID_RANGE:${part}`);
    }
    const dash = span.split("-");
    if (!dash[0]!.trim() || (dash.length > 1 && !dash[1]!.trim())) {
      throw new Error(`INVALID_RANGE:${part}`);
    }
    const start = parseCodePoint(dash[0]!.trim());
    const end = dash[1] ? parseCodePoint(dash[1]!.trim()) : start;
    const remap = hasRemap ? parseCodePoint(remapRaw) : start;
    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      Number.isNaN(remap) ||
      start < 0 ||
      end < start
    ) {
      throw new Error(`INVALID_RANGE:${part}`);
    }
  }
}

function parseCodePoint(text: string): number {
  const t = text.trim().toLowerCase();
  if (t.startsWith("0x")) {
    return Number.parseInt(t.slice(2), 16);
  }
  return Number.parseInt(t, 10);
}

/** 标识片段：仅清洗字符，不加 `font_` 前缀（避免自动命名双重前缀） */
export function sanitizeIdentFragment(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "font";
}

/** 规范化 C/文件安全的字体名 */
export function sanitizeFontName(name: string): string {
  const cleaned = sanitizeIdentFragment(name);
  if (/^[0-9]/.test(cleaned)) {
    return `font_${cleaned}`;
  }
  return cleaned;
}
