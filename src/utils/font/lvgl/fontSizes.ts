import { buildAutoLvglFontName } from "./autoFontName";
import { sanitizeFontName } from "./range";
import {
  DEFAULT_LVGL_FONT_OPTIONS,
  LVGL_FONT_SIZE_MAX,
  LVGL_FONT_SIZE_MIN,
} from "./types";

/** 一次最多导出的字号数量，防止误输导致长时间占用 */
export const LVGL_FONT_SIZES_MAX_COUNT = 16;

/** 将单个值夹到合法字号；无效返回 null */
export function clampFontSize(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    // 拒绝明显非数字（如 "16px"）
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return null;
    }
    value = Number(trimmed);
  }
  if (typeof value !== "number") {
    return null;
  }
  const n = value;
  if (!Number.isFinite(n)) {
    return null;
  }
  return Math.min(
    LVGL_FONT_SIZE_MAX,
    Math.max(LVGL_FONT_SIZE_MIN, Math.round(n))
  );
}

/**
 * 规范化字号列表：夹紧、去重、排序、截断。
 * 空输入回退为默认字号。
 */
export function normalizeFontSizes(values: unknown[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of values) {
    const size = clampFontSize(raw);
    if (size == null || seen.has(size)) {
      continue;
    }
    seen.add(size);
    out.push(size);
    if (out.length >= LVGL_FONT_SIZES_MAX_COUNT) {
      break;
    }
  }
  if (!out.length) {
    return [DEFAULT_LVGL_FONT_OPTIONS.size];
  }
  out.sort((a, b) => a - b);
  return out;
}

/**
 * 解析 UI tags / 逗号分隔输入为字号列表。
 * 支持 number、数字字符串、以及 `"14, 16 20"` 这类混写。
 */
export function parseFontSizesInput(
  input: unknown
): { sizes: number[]; truncated: boolean; invalidCount: number } {
  const tokens: unknown[] = [];
  const pushToken = (v: unknown) => {
    if (typeof v === "string") {
      for (const part of v.split(/[\s,;；，、]+/)) {
        const t = part.trim();
        if (t) {
          tokens.push(t);
        }
      }
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) {
        pushToken(item);
      }
      return;
    }
    if (v != null && v !== "") {
      tokens.push(v);
    }
  };
  pushToken(input);

  let invalidCount = 0;
  const rawValid: number[] = [];
  for (const token of tokens) {
    const size = clampFontSize(token);
    if (size == null) {
      invalidCount += 1;
      continue;
    }
    rawValid.push(size);
  }

  const uniqueBeforeCap = new Set(rawValid);
  const truncated = uniqueBeforeCap.size > LVGL_FONT_SIZES_MAX_COUNT;
  return {
    sizes: normalizeFontSizes(rawValid),
    truncated,
    invalidCount,
  };
}

/** 自动命名时生成展示用名称（取列表中第一个字号） */
export function buildDisplayAutoFontName(
  nameSlug: string,
  sizes: number[],
  bpp: number
): string {
  const list = normalizeFontSizes(sizes);
  return buildAutoLvglFontName(nameSlug, list[0]!, bpp);
}

/**
 * 为某一字号解析最终 C/文件名。
 * - 自动命名：`font_{slug}_{size}_{bpp}`
 * - 手动且仅一字号：使用用户名
 * - 手动且多字号：在基名后追加 `_{size}`，避免互相覆盖
 */
export function resolveFontNameForSize(input: {
  autoName: boolean;
  nameSlug: string;
  baseFontName: string;
  size: number;
  bpp: number;
  sizeCount: number;
}): string {
  const size =
    clampFontSize(input.size) ?? DEFAULT_LVGL_FONT_OPTIONS.size;
  if (input.autoName) {
    return buildAutoLvglFontName(input.nameSlug, size, input.bpp);
  }
  const base = sanitizeFontName(input.baseFontName || "font");
  if (input.sizeCount <= 1) {
    return base;
  }
  // 若用户基名已以 _字号 结尾则不再重复追加
  if (new RegExp(`_${size}$`).test(base)) {
    return base;
  }
  return sanitizeFontName(`${base}_${size}`);
}
