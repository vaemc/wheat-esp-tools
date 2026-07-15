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

export async function encodeGifToEaf(
  gifBytes: Uint8Array,
  options: EafEncodeOptions = {}
): Promise<EafEncodeResult> {
  const splitHeight = Math.max(1, options.splitHeight ?? EAF_DEFAULT_SPLIT_HEIGHT);
  let encodingMode: EafEncodingMode = options.encodingMode ?? EAF_DEFAULT_ENCODING;
  let colorDepth: EafColorDepth = options.colorDepth ?? EAF_DEFAULT_COLOR_DEPTH;
  const jpegQuality = Math.max(
    11,
    Math.min(100, options.jpegQuality ?? EAF_DEFAULT_JPEG_QUALITY)
  );

  if (encodingMode === "jpeg") {
    colorDepth = 24;
  } else if (colorDepth === 24) {
    encodingMode = "jpeg";
  } else if (colorDepth !== 4 && colorDepth !== 8) {
    colorDepth = 8;
  }

  const rawFrames = await extractGifFrames(gifBytes);
  if (rawFrames.length === 0) {
    throw new Error("GIF has no frames");
  }

  const targetW = Math.max(1, options.width ?? rawFrames[0].imageData.width);
  const targetH = Math.max(1, options.height ?? rawFrames[0].imageData.height);

  const frames: GifFrame[] = rawFrames.map((f) => ({
    imageData: resizeImageData(f.imageData, targetW, targetH),
    delayMs: f.delayMs,
  }));

  const contentCache = new Map<string, Uint8Array>();
  const payloads: Uint8Array[] = [];

  for (const frame of frames) {
    const hash = imageDataHash(frame.imageData);
    let payload = contentCache.get(hash);
    if (!payload) {
      payload = await encodeSingleFrame(frame.imageData, {
        splitHeight,
        colorDepth,
        encodingMode,
        jpegQuality,
      });
      contentCache.set(hash, payload);
    }
    payloads.push(payload);
  }

  const bytes = packEafContainer(payloads);
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
