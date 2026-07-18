import { Buffer } from "buffer";
import {
  buildOptsString,
  parseUnicodeRange,
  sanitizeFontName,
} from "./range";
import type {
  LvglFontConvertOptions,
  LvglFontConvertResult,
  LvglFontFormat,
} from "./types";

/** lv_font_conv convert() 返回的文件字典 */
type ConvertFiles = Record<string, string | Buffer | Uint8Array>;

type ConvertFn = (args: Record<string, unknown>) => Promise<ConvertFiles>;

let convertFn: ConvertFn | null = null;

async function getConvert(): Promise<ConvertFn> {
  if (convertFn) {
    return convertFn;
  }
  // CommonJS 模块；Vite + nodePolyfills 下可动态导入
  const mod = await import("lv_font_conv/lib/convert.js");
  const fn =
    (mod as { default?: ConvertFn }).default ??
    (mod as unknown as ConvertFn);
  convertFn = fn;
  return fn;
}

function toUint8Array(data: string | Buffer | Uint8Array): Uint8Array {
  if (typeof data === "string") {
    return new TextEncoder().encode(data);
  }
  return Uint8Array.from(data);
}

function toString(data: string | Buffer | Uint8Array): string {
  if (typeof data === "string") {
    return data;
  }
  return new TextDecoder().decode(toUint8Array(data));
}

function buildFontArgs(
  fontBytes: Uint8Array,
  fontFileName: string,
  options: LvglFontConvertOptions,
  format: "bin" | "lvgl"
) {
  const fontName = sanitizeFontName(options.fontName);
  const range = options.range.trim()
    ? parseUnicodeRange(options.range)
    : [];
  const symbols = options.symbols ?? "";

  if (!range.length && !symbols.length) {
    throw new Error("EMPTY_GLYPHS");
  }

  if (options.bpp === 3 && !options.compress) {
    throw new Error("BPP3_NEEDS_COMPRESS");
  }

  const sourceBin = Buffer.from(fontBytes);

  return {
    font: [
      {
        source_path: fontFileName,
        source_bin: sourceBin,
        ranges: [
          {
            range,
            symbols,
          },
        ],
      },
    ],
    size: Math.max(1, Math.round(options.size)),
    bpp: options.bpp,
    no_compress: !options.compress,
    lcd: !!options.lcd,
    lcd_v: !!options.lcdV,
    use_color_info: !!options.useColorInfo,
    no_kerning: !!options.noKerning,
    format,
    output: format === "bin" ? `${fontName}.bin` : fontName,
    lv_font_name: fontName,
    lv_fallback: options.fallback.trim() || undefined,
    lv_include: options.lvInclude.trim() || undefined,
    opts_string: buildOptsString({ ...options, fontName }, fontFileName),
  };
}

async function convertOnce(
  fontBytes: Uint8Array,
  fontFileName: string,
  options: LvglFontConvertOptions,
  format: "bin" | "lvgl"
): Promise<{ key: string; data: string | Buffer | Uint8Array }> {
  const convert = await getConvert();
  const args = buildFontArgs(fontBytes, fontFileName, options, format);
  const files = await convert(args);
  const key = Object.keys(files)[0];
  if (!key || files[key] == null) {
    throw new Error("CONVERT_EMPTY");
  }
  return { key, data: files[key]! };
}

function formatsToRun(format: LvglFontFormat): Array<"bin" | "lvgl"> {
  if (format === "both") {
    return ["lvgl", "bin"];
  }
  return [format];
}

/**
 * 将 TTF/OTF/WOFF 字节转换为 LVGL C 数组和/或二进制字体。
 * 基于官方 lv_font_conv（浏览器端 FreeType WASM）。
 */
export async function convertLvglFont(
  fontBytes: Uint8Array,
  fontFileName: string,
  options: LvglFontConvertOptions
): Promise<LvglFontConvertResult> {
  const fontName = sanitizeFontName(options.fontName);
  const result: LvglFontConvertResult = {
    fontName,
    size: options.size,
    bpp: options.bpp,
  };

  for (const format of formatsToRun(options.format)) {
    const { data } = await convertOnce(
      fontBytes,
      fontFileName,
      { ...options, fontName },
      format
    );
    if (format === "lvgl") {
      result.cSource = toString(data);
    } else {
      result.binBytes = toUint8Array(data);
    }
  }

  return result;
}

export { sanitizeFontName };
