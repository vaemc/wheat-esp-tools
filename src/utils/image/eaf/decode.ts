import { toArrayBuffer } from "./bytes";
import { huffmanDecode } from "./huffman";
import { unpackIndices4 } from "./palette";
import { rleDecode } from "./rle";
import type { EafDecodeResult, EafFrameMeta } from "./types";

export interface DecodeEafOptions {
  /** 每完成一帧回调；可用于边解边预览 */
  onFrame?: (
    canvas: HTMLCanvasElement,
    index: number,
    meta: EafFrameMeta
  ) => void;
  /** current 已完成帧数，total 可解帧总数 */
  onProgress?: (current: number, total: number) => void;
  signal?: AbortSignal;
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    const ric = (
      window as Window & {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number }
        ) => number;
      }
    ).requestIdleCallback;
    if (typeof ric === "function") {
      ric(() => resolve(), { timeout: 24 });
      return;
    }
    window.setTimeout(resolve, 0);
  });
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

function toImageData(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): ImageData {
  // putImageData 需要独立 ArrayBuffer，不能直接用子视图
  const copy = new Uint8ClampedArray(rgba.length);
  copy.set(rgba);
  return new ImageData(copy, width, height);
}

function u16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

function ascii(bytes: Uint8Array) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

type ParsedFrame = {
  meta: EafFrameMeta;
  data: Uint8Array;
  dataOffset: number;
  blockLens: number[];
  palette: Uint8Array | null;
};

function parseContainer(bytes: Uint8Array): {
  frameCount: number;
  frames: Uint8Array[];
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let base = 0;
  if (bytes[0] === 0x89) {
    const tag = ascii(bytes.subarray(1, 4));
    if (tag !== "EAF" && tag !== "AAF") {
      throw new Error("Invalid EAF magic");
    }
    base = 4;
  }
  const frameCount = u32(view, base);
  const storedLen = u32(view, base + 8);
  const tableOffset = base + 12;
  const body = bytes.subarray(tableOffset, tableOffset + storedLen);
  const bodyView = new DataView(body.buffer, body.byteOffset, body.byteLength);
  const tableBytes = frameCount * 8;
  const frames: Uint8Array[] = [];

  for (let i = 0; i < frameCount; i++) {
    const size = u32(bodyView, i * 8);
    const offset = u32(bodyView, i * 8 + 4);
    const start = tableBytes + offset;
    const end = start + size;
    if (end > body.length) {
      continue;
    }
    const entry = body.subarray(start, end);
    if (entry[0] !== 0x5a || entry[1] !== 0x5a) {
      continue;
    }
    frames.push(entry.subarray(2));
  }
  if (frames.length === 0) {
    throw new Error("No decodable frames in EAF");
  }
  return { frameCount: frames.length, frames };
}

function parseFrame(payload: Uint8Array): ParsedFrame | null {
  if (payload.length < 18) {
    return null;
  }
  if (!(payload[0] === 0x5f && payload[1] === 0x53 && payload[2] === 0x00)) {
    // redirect / unknown
    return null;
  }
  const view = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength
  );
  const rawDepth = payload[9];
  const bitDepth = (rawDepth === 4 || rawDepth === 8 || rawDepth === 24
    ? rawDepth
    : 8) as 4 | 8 | 24;
  const width = u16(view, 10);
  const height = u16(view, 12);
  const blockCount = u16(view, 14);
  const splitHeight = u16(view, 16);
  const blockLens: number[] = [];
  for (let i = 0; i < blockCount; i++) {
    blockLens.push(u32(view, 18 + i * 4));
  }
  let cursor = 18 + blockCount * 4;
  let palette: Uint8Array | null = null;
  if (bitDepth === 4) {
    palette = payload.subarray(cursor, cursor + 64);
    cursor += 64;
  } else if (bitDepth === 8) {
    palette = payload.subarray(cursor, cursor + 1024);
    cursor += 1024;
  }
  return {
    meta: { width, height, splitHeight, bitDepth, blockCount },
    data: payload,
    dataOffset: cursor,
    blockLens,
    palette,
  };
}

function paletteToRgba(
  indices: Uint8Array,
  palette: Uint8Array
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(indices.length * 4);
  for (let i = 0; i < indices.length; i++) {
    const po = indices[i] * 4;
    const o = i * 4;
    // palette is BGRA
    out[o] = palette[po + 2];
    out[o + 1] = palette[po + 1];
    out[o + 2] = palette[po];
    out[o + 3] = palette[po + 3] || 255;
  }
  return out;
}

function bgrToRgba(bgr: Uint8Array): Uint8ClampedArray {
  const n = (bgr.length / 3) | 0;
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    out[i * 4] = bgr[i * 3 + 2];
    out[i * 4 + 1] = bgr[i * 3 + 1];
    out[i * 4 + 2] = bgr[i * 3];
    out[i * 4 + 3] = 255;
  }
  return out;
}

async function drawJpegStrip(
  ctx: CanvasRenderingContext2D,
  jpeg: Uint8Array,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const blob = new Blob([toArrayBuffer(jpeg)], { type: "image/jpeg" });
  const bmp = await createImageBitmap(blob);
  ctx.drawImage(bmp, x, y, w, h);
  bmp.close();
}

async function frameToCanvas(
  parsed: ParsedFrame,
  signal?: AbortSignal
): Promise<HTMLCanvasElement> {
  const { meta, data, dataOffset, blockLens, palette } = parsed;
  const canvas = document.createElement("canvas");
  canvas.width = meta.width;
  canvas.height = meta.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D unavailable");
  }
  ctx.imageSmoothingEnabled = false;

  let cursor = dataOffset;
  let y = 0;
  let lastYield = performance.now();
  for (let i = 0; i < meta.blockCount; i++) {
    throwIfAborted(signal);
    const len = blockLens[i] >>> 0;
    const end = cursor + len;
    if (end > data.length) {
      break;
    }
    const enc = data[cursor];
    const stripH = Math.min(meta.splitHeight, meta.height - y);
    const expected =
      meta.bitDepth === 24
        ? meta.width * stripH * 3
        : meta.bitDepth === 8
          ? meta.width * stripH
          : Math.ceil((meta.width * stripH) / 2);

    if (enc === 2) {
      await drawJpegStrip(
        ctx,
        data.subarray(cursor + 1, end),
        0,
        y,
        meta.width,
        stripH
      );
      y += stripH;
      cursor = end;
      lastYield = performance.now();
      continue;
    }

    let raw: Uint8Array;
    if (enc === 1 || enc === 3) {
      const view = new DataView(data.buffer, data.byteOffset + cursor + 1);
      const dictLen = view.getUint16(0, true);
      const dictStart = cursor + 3;
      const dictEnd = dictStart + dictLen;
      const dict = data.subarray(dictStart, dictEnd);
      const compressed = data.subarray(dictEnd, end);
      const decoded = huffmanDecode(
        compressed,
        dict,
        enc === 3 ? expected : undefined
      );
      raw = enc === 1 ? rleDecode(decoded, expected) : decoded;
    } else if (enc === 0) {
      raw = rleDecode(data.subarray(cursor + 1, end), expected);
    } else {
      // raw / unknown
      raw = data.subarray(cursor + 1, end);
    }

    if (meta.bitDepth === 24) {
      const rgba = bgrToRgba(raw.subarray(0, expected));
      ctx.putImageData(toImageData(rgba, meta.width, stripH), 0, y);
    } else if (meta.bitDepth === 8 && palette) {
      const rgba = paletteToRgba(raw.subarray(0, expected), palette);
      ctx.putImageData(toImageData(rgba, meta.width, stripH), 0, y);
    } else if (palette) {
      const indices = unpackIndices4(raw, meta.width * stripH);
      const rgba = paletteToRgba(indices, palette);
      ctx.putImageData(toImageData(rgba, meta.width, stripH), 0, y);
    }

    y += stripH;
    cursor = end;

    // 累计忙超过 ~12ms 就让出事件循环，避免大帧卡住 UI
    if (performance.now() - lastYield >= 12) {
      await yieldToUi();
      lastYield = performance.now();
    }
  }
  return canvas;
}

/** 解码 EAF 为可预览的 canvas 帧列表（协作式，不长时间占满主线程） */
export async function decodeEaf(
  bytes: Uint8Array,
  options: DecodeEafOptions = {}
): Promise<EafDecodeResult> {
  throwIfAborted(options.signal);
  const { frames: payloads } = parseContainer(bytes);
  await yieldToUi();

  const parsedFrames: ParsedFrame[] = [];
  for (const payload of payloads) {
    throwIfAborted(options.signal);
    const parsed = parseFrame(payload);
    if (parsed) {
      parsedFrames.push(parsed);
    }
  }
  if (parsedFrames.length === 0) {
    throw new Error("No frames rendered");
  }

  const canvases: HTMLCanvasElement[] = [];
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let splitHeight = 16;

  options.onProgress?.(0, parsedFrames.length);

  for (let i = 0; i < parsedFrames.length; i++) {
    throwIfAborted(options.signal);
    const parsed = parsedFrames[i];
    width = parsed.meta.width;
    height = parsed.meta.height;
    bitDepth = parsed.meta.bitDepth;
    splitHeight = parsed.meta.splitHeight;

    const canvas = await frameToCanvas(parsed, options.signal);
    canvases.push(canvas);
    options.onFrame?.(canvas, canvases.length - 1, parsed.meta);
    options.onProgress?.(canvases.length, parsedFrames.length);
    await yieldToUi();
  }

  return {
    frames: canvases,
    width,
    height,
    frameCount: canvases.length,
    bitDepth,
    splitHeight,
  };
}

export function isEafBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 16) {
    return false;
  }
  if (bytes[0] === 0x89) {
    const tag = ascii(bytes.subarray(1, 4));
    return tag === "EAF" || tag === "AAF";
  }
  // legacy without magic
  return bytes.length >= 12;
}
