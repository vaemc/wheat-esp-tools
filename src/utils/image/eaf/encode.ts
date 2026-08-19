import { huffmanEncode } from "./huffman";
import {
  packIndices4,
  quantizeColor8,
  quantizeGray4,
} from "./palette";
import { rleEncode } from "./rle";
import { extractGifFrames, imageDataHash, resizeImageData } from "./gifFrames";
import type {
  EafColorDepth,
  EafEncodeOptions,
  EafEncodeResult,
  EafEncodingMode,
  GifFrame,
} from "./types";
import {
  EAF_DEFAULT_COLOR_DEPTH,
  EAF_DEFAULT_ENCODING,
  EAF_DEFAULT_JPEG_QUALITY,
  EAF_DEFAULT_SIMILAR_THRESHOLD,
  EAF_DEFAULT_SPLIT_HEIGHT,
} from "./types";

const ENC_RLE = 0;
const ENC_HUFFMAN_RLE = 1;
const ENC_JPEG = 2;

function u16(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
}

function u32(n: number): Uint8Array {
  return new Uint8Array([
    n & 0xff,
    (n >> 8) & 0xff,
    (n >> 16) & 0xff,
    (n >> 24) & 0xff,
  ]);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function checksum(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum = (sum + data[i]) >>> 0;
  }
  return sum >>> 0;
}

async function canvasJpegBytes(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Uint8Array> {
  const q = Math.max(0.11, Math.min(1, quality / 100));
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("JPEG encode failed"))),
      "image/jpeg",
      q
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

function buildFrameHeader(
  width: number,
  height: number,
  blocks: number,
  blockHeight: number,
  bitDepth: EafColorDepth,
  blockLens: number[]
): Uint8Array {
  // `_S\0` + 版本区 + bit_depth，对齐官方 sample / 解码器偏移
  const head = new Uint8Array(18 + blockLens.length * 4);
  head[0] = 0x5f; // _
  head[1] = 0x53; // S
  head[2] = 0x00;
  // version-ish padding, sample uses zeros then 0x01
  head[8] = 0x01;
  head[9] = bitDepth;
  head.set(u16(width), 10);
  head.set(u16(height), 12);
  head.set(u16(blocks), 14);
  head.set(u16(blockHeight), 16);
  for (let i = 0; i < blockLens.length; i++) {
    head.set(u32(blockLens[i]), 18 + i * 4);
  }
  return head;
}

function encodeBlockPayload(
  raw: Uint8Array,
  mode: EafEncodingMode
): Uint8Array {
  if (mode === "jpeg") {
    // JPEG 由上层处理
    return raw;
  }
  const rle = rleEncode(raw);
  if (mode === "rle") {
    return concatBytes([new Uint8Array([ENC_RLE]), rle]);
  }
  // rle_huffman：在 RLE 结果上再尝试 Huffman
  const { compressed, dict } = huffmanEncode(rle);
  const huffPayload = concatBytes([
    new Uint8Array([ENC_HUFFMAN_RLE]),
    u16(dict.length),
    dict,
    compressed,
  ]);
  const rlePayload = concatBytes([new Uint8Array([ENC_RLE]), rle]);
  return huffPayload.length < rlePayload.length ? huffPayload : rlePayload;
}

async function encodeJpegFrame(
  imageData: ImageData,
  splitHeight: number,
  jpegQuality: number
): Promise<Uint8Array> {
  const { width, height } = imageData;
  const blocks = Math.ceil(height / splitHeight);
  const src = document.createElement("canvas");
  src.width = width;
  src.height = height;
  const sctx = src.getContext("2d");
  if (!sctx) {
    throw new Error("Canvas 2D unavailable");
  }
  sctx.putImageData(imageData, 0, 0);

  const strip = document.createElement("canvas");
  strip.width = width;
  const tctx = strip.getContext("2d");
  if (!tctx) {
    throw new Error("Canvas 2D unavailable");
  }

  const chunks: Uint8Array[] = [];
  const lens: number[] = [];
  for (let i = 0; i < blocks; i++) {
    const y = i * splitHeight;
    const h = Math.min(splitHeight, height - y);
    strip.height = h;
    tctx.clearRect(0, 0, width, h);
    tctx.drawImage(src, 0, y, width, h, 0, 0, width, h);
    const jpeg = await canvasJpegBytes(strip, jpegQuality);
    const block = concatBytes([new Uint8Array([ENC_JPEG]), jpeg]);
    chunks.push(block);
    lens.push(block.length);
  }
  const header = buildFrameHeader(width, height, blocks, splitHeight, 24, lens);
  return concatBytes([header, ...chunks]);
}

function encodeIndexedFrame(
  imageData: ImageData,
  splitHeight: number,
  bitDepth: 4 | 8,
  mode: EafEncodingMode
): Uint8Array {
  const { width, height, data } = imageData;
  const { indices, palette } =
    bitDepth === 4
      ? quantizeGray4(data, width, height)
      : quantizeColor8(data);

  const blocks = Math.ceil(height / splitHeight);
  const chunks: Uint8Array[] = [];
  const lens: number[] = [];

  for (let i = 0; i < blocks; i++) {
    const y0 = i * splitHeight;
    const h = Math.min(splitHeight, height - y0);
    const slice = indices.subarray(y0 * width, (y0 + h) * width);
    const packed =
      bitDepth === 4 ? packIndices4(slice, width, h) : new Uint8Array(slice);
    const payload = encodeBlockPayload(packed, mode);
    chunks.push(payload);
    lens.push(payload.length);
  }

  const header = buildFrameHeader(
    width,
    height,
    blocks,
    splitHeight,
    bitDepth,
    lens
  );
  return concatBytes([header, palette, ...chunks]);
}

async function encodeSingleFrame(
  imageData: ImageData,
  options: {
    splitHeight: number;
    colorDepth: EafColorDepth;
    encodingMode: EafEncodingMode;
    jpegQuality: number;
  }
): Promise<Uint8Array> {
  if (options.encodingMode === "jpeg" || options.colorDepth === 24) {
    return encodeJpegFrame(
      imageData,
      options.splitHeight,
      options.jpegQuality
    );
  }
  return encodeIndexedFrame(
    imageData,
    options.splitHeight,
    options.colorDepth === 4 ? 4 : 8,
    options.encodingMode
  );
}

function packEafContainer(framePayloads: Uint8Array[]): Uint8Array {
  // 去重：同一 payload 引用共用 offset（encodeGifToEaf 已按内容缓存）
  const uniqueMap = new Map<object, { offset: number; size: number }>();
  const parts: Uint8Array[] = [];
  let offset = 0;
  const tableEntries: { size: number; offset: number }[] = [];

  for (const payload of framePayloads) {
    const existing = uniqueMap.get(payload);
    if (existing) {
      tableEntries.push({ size: existing.size, offset: existing.offset });
      continue;
    }
    const prefixed = concatBytes([new Uint8Array([0x5a, 0x5a]), payload]);
    uniqueMap.set(payload, { offset, size: prefixed.length });
    tableEntries.push({ size: prefixed.length, offset });
    parts.push(prefixed);
    offset += prefixed.length;
  }

  const table = new Uint8Array(tableEntries.length * 8);
  for (let i = 0; i < tableEntries.length; i++) {
    table.set(u32(tableEntries[i].size), i * 8);
    table.set(u32(tableEntries[i].offset), i * 8 + 4);
  }
  const body = concatBytes([table, ...parts]);
  const chk = checksum(body);
  return concatBytes([
    new Uint8Array([0x89, 0x45, 0x41, 0x46]), // \x89EAF
    u32(tableEntries.length),
    u32(chk),
    u32(body.length),
    body,
  ]);
}

export interface EncodeFramesProgress {
  stage: "resize" | "encode" | "pack";
  current: number;
  total: number;
  percent: number;
  message: string;
}

function selectFramesByStep(frames: GifFrame[], frameStep: number): GifFrame[] {
  if (frameStep <= 0 || frames.length <= 1) {
    return frames;
  }
  const out: GifFrame[] = [];
  let i = 0;
  while (i < frames.length) {
    let kept = 0;
    while (kept < frameStep && i < frames.length) {
      out.push(frames[i]);
      i += 1;
      kept += 1;
    }
    i += 1;
  }
  return out.length > 0 ? out : frames.slice(0, 1);
}

function framesSimilar(
  a: ImageData,
  b: ImageData,
  threshold: number
): boolean {
  if (a.width !== b.width || a.height !== b.height || a.data.length === 0) {
    return false;
  }
  if (threshold === 0) {
    const ad = a.data;
    const bd = b.data;
    for (let i = 0; i < ad.length; i++) {
      if (ad[i] !== bd[i]) {
        return false;
      }
    }
    return true;
  }
  const step = 16;
  let sum = 0;
  let count = 0;
  const ad = a.data;
  const bd = b.data;
  for (let i = 0; i + 3 < ad.length; i += step) {
    const dr = Math.abs(ad[i] - bd[i]);
    const dg = Math.abs(ad[i + 1] - bd[i + 1]);
    const db = Math.abs(ad[i + 2] - bd[i + 2]);
    sum += (dr + dg + db) / 3;
    count += 1;
  }
  if (count === 0) {
    return true;
  }
  return sum / count <= threshold;
}

function yieldToUi() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

export async function encodeFramesToEaf(
  rawFrames: GifFrame[],
  options: EafEncodeOptions = {},
  onProgress?: (event: EncodeFramesProgress) => void
): Promise<EafEncodeResult> {
  let encodingMode: EafEncodingMode =
    options.encodingMode ?? EAF_DEFAULT_ENCODING;
  let colorDepth: EafColorDepth =
    options.colorDepth ?? EAF_DEFAULT_COLOR_DEPTH;
  const jpegQuality = Math.max(
    11,
    Math.min(100, options.jpegQuality ?? EAF_DEFAULT_JPEG_QUALITY)
  );
  const frameStep = options.frameStep ?? 0;
  const similarThreshold =
    options.similarThreshold ?? EAF_DEFAULT_SIMILAR_THRESHOLD;

  if (encodingMode === "jpeg") {
    colorDepth = 24;
  } else if (colorDepth === 24) {
    encodingMode = "jpeg";
  } else if (colorDepth !== 4 && colorDepth !== 8) {
    colorDepth = 8;
  }

  if (rawFrames.length === 0) {
    throw new Error("没有可编码的帧");
  }

  const stepped = selectFramesByStep(rawFrames, frameStep);
  const targetW = Math.max(1, options.width ?? stepped[0].imageData.width);
  const targetH = Math.max(1, options.height ?? stepped[0].imageData.height);
  const isJpeg = encodingMode === "jpeg" || colorDepth === 24;
  const requestedSplit = options.splitHeight ?? EAF_DEFAULT_SPLIT_HEIGHT;
  const splitHeight =
    requestedSplit <= 0
      ? isJpeg
        ? Math.max(targetH, 512)
        : targetH
      : Math.max(1, requestedSplit);

  const frames: GifFrame[] = [];
  for (let i = 0; i < stepped.length; i++) {
    frames.push({
      imageData: resizeImageData(stepped[i].imageData, targetW, targetH),
      delayMs: stepped[i].delayMs,
    });
    onProgress?.({
      stage: "resize",
      current: i + 1,
      total: stepped.length,
      percent: 5 + ((i + 1) / stepped.length) * 15,
      message: `缩放帧 ${i + 1}/${stepped.length}`,
    });
    if (i % 8 === 7) {
      await yieldToUi();
    }
  }

  const payloads: Uint8Array[] = [];
  const exactCache = new Map<string, Uint8Array>();
  let lastUnique: ImageData | null = null;
  let lastPayload: Uint8Array | null = null;

  for (let i = 0; i < frames.length; i++) {
    const imageData = frames[i].imageData;
    const hash = imageDataHash(imageData);
    let payload = exactCache.get(hash);

    if (!payload && similarThreshold > 0 && lastUnique && lastPayload) {
      if (framesSimilar(imageData, lastUnique, similarThreshold)) {
        payload = lastPayload;
        exactCache.set(hash, payload);
      }
    }

    if (!payload) {
      payload = await encodeSingleFrame(imageData, {
        splitHeight,
        colorDepth,
        encodingMode,
        jpegQuality,
      });
      exactCache.set(hash, payload);
      lastUnique = imageData;
      lastPayload = payload;
    }

    payloads.push(payload);
    onProgress?.({
      stage: "encode",
      current: i + 1,
      total: frames.length,
      percent: 20 + ((i + 1) / frames.length) * 74,
      message: `编码帧 ${i + 1}/${frames.length}`,
    });
    if (i % 4 === 3) {
      await yieldToUi();
    }
  }

  onProgress?.({
    stage: "pack",
    current: payloads.length,
    total: payloads.length,
    percent: 97,
    message: "正在打包 EAF…",
  });
  const bytes = packEafContainer(payloads);
  onProgress?.({
    stage: "pack",
    current: payloads.length,
    total: payloads.length,
    percent: 100,
    message: "完成",
  });

  return {
    bytes,
    width: targetW,
    height: targetH,
    frameCount: payloads.length,
    splitHeight,
    colorDepth,
    encodingMode,
    sizeBytes: bytes.length,
  };
}

export async function encodeGifToEaf(
  gifBytes: Uint8Array,
  options: EafEncodeOptions = {}
): Promise<EafEncodeResult> {
  const rawFrames = await extractGifFrames(gifBytes);
  if (rawFrames.length === 0) {
    throw new Error("GIF has no frames");
  }
  return encodeFramesToEaf(rawFrames, options);
}
