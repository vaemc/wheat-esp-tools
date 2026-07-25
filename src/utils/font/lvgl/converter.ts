import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { parseUnicodeRange, sanitizeFontName } from "./range";
import type {
  LvglFontConvertOptions,
  LvglFontConvertResult,
  LvglFontProgressEvent,
} from "./types";

export type { LvglFontProgressEvent };

export type ProgressHandler = (event: LvglFontProgressEvent) => void;

let progressUnlisten: UnlistenFn | null = null;
const progressHandlers = new Set<ProgressHandler>();

async function ensureProgressListener() {
  if (progressUnlisten) {
    return;
  }
  progressUnlisten = await listen<LvglFontProgressEvent>(
    "lvgl_font_progress",
    (event) => {
      for (const handler of progressHandlers) {
        handler(event.payload);
      }
    }
  );
}

/** 订阅转换进度；返回取消订阅函数 */
export async function onLvglFontProgress(
  handler: ProgressHandler
): Promise<() => void> {
  await ensureProgressListener();
  progressHandlers.add(handler);
  return () => {
    progressHandlers.delete(handler);
  };
}

interface RustConvertResult {
  fontName: string;
  size: number;
  bpp: number;
  cSource?: string | null;
  glyphCount: number;
  elapsedMs: number;
}

export interface ConvertLvglFontInput {
  fontBytes: Uint8Array;
  fontFileName: string;
  options: LvglFontConvertOptions;
  /** 有本地路径时优先走磁盘读取，避免大字体 IPC 拷贝 */
  fontPath?: string | null;
  jobId?: string;
}

/**
 * 将 TTF/OTF 转换为 LVGL C 数组（纯 Rust + fontdue，后台线程，带进度事件）。
 */
export async function convertLvglFont(
  input: ConvertLvglFontInput
): Promise<LvglFontConvertResult> {
  const { fontBytes, fontFileName, options, fontPath, jobId } = input;
  const fontName = sanitizeFontName(options.fontName);

  const range = options.range.trim();
  const symbols = options.symbols ?? "";
  if (range) {
    parseUnicodeRange(range);
  }
  if (!range && !symbols.length) {
    throw new Error("EMPTY_GLYPHS");
  }

  await ensureProgressListener();

  const id =
    jobId ??
    `lvgl-font-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const rustOptions = {
    fontName,
    size: Math.max(
      4,
      Math.min(256, Math.round(options.size) || 16)
    ),
    bpp: options.bpp,
    format: "lvgl",
    range,
    symbols,
    fallback: options.fallback.trim(),
    lvInclude: options.lvInclude.trim(),
  };

  const payload: Record<string, unknown> = {
    fontFileName,
    options: rustOptions,
    jobId: id,
    fontPath: fontPath || null,
    fontBytes: null as number[] | null,
  };

  // 无本地路径时才传字节（拖入的 File）；用普通数组以兼容 serde Vec<u8>
  if (!fontPath) {
    if (fontBytes.byteLength === 0) {
      throw new Error("字体数据为空");
    }
    payload.fontBytes = Array.from(fontBytes);
  }

  const raw = await invoke<RustConvertResult>("convert_lvgl_font", payload);

  return {
    fontName: raw.fontName,
    size: raw.size,
    bpp: raw.bpp,
    glyphCount: raw.glyphCount,
    elapsedMs: raw.elapsedMs,
    cSource: raw.cSource ?? undefined,
  };
}

export { sanitizeFontName };
