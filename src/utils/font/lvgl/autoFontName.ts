import { sanitizeFontName, sanitizeIdentFragment } from "./range";
import {
  LVGL_FONT_SIZE_MAX,
  LVGL_FONT_SIZE_MIN,
} from "./types";

/** `font_{slug}_{size}_{bpp}`；slug 只做片段清洗，最终再 sanitize 一次 */
export function buildAutoLvglFontName(
  nameSlug: string,
  size: number,
  bpp: number
): string {
  const slug = sanitizeIdentFragment(nameSlug || "font");
  const safeSize = Math.min(
    LVGL_FONT_SIZE_MAX,
    Math.max(LVGL_FONT_SIZE_MIN, Math.round(size) || 16)
  );
  const safeBpp = [1, 2, 4, 8].includes(bpp) ? bpp : 4;
  return sanitizeFontName(`font_${slug}_${safeSize}_${safeBpp}`);
}
