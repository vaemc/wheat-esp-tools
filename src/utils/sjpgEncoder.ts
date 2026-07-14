import { join } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

const SJPG_MAGIC = "_SJPG__";
const SJPG_VERSION = "V1.00";
export const DEFAULT_SPLIT_HEIGHT = 16;

export interface SjpgEncodeOptions {
  quality?: number;
  splitHeight?: number;
  variableName?: string;
}

export interface SjpgEncodeResult {
  bytes: Uint8Array;
  width: number;
  height: number;
  splits: number;
  splitHeight: number;
  cSource: string;
}

function writeU16LE(value: number): Uint8Array {
  const buf = new Uint8Array(2);
  buf[0] = value & 0xff;
  buf[1] = (value >> 8) & 0xff;
  return buf;
}

async function canvasToJpegBytes(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("JPEG encode failed"))),
      "image/jpeg",
      quality
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

function buildHeader(
  width: number,
  height: number,
  splitHeight: number,
  chunkLengths: number[]
): Uint8Array {
  const versionBytes = new TextEncoder().encode(`\0${SJPG_VERSION}\0`);
  const headerSize =
    SJPG_MAGIC.length + versionBytes.length + 10 + chunkLengths.length * 2;
  const header = new Uint8Array(headerSize);
  let offset = 0;

  header.set(new TextEncoder().encode(SJPG_MAGIC), offset);
  offset += SJPG_MAGIC.length;
  header.set(versionBytes, offset);
  offset += versionBytes.length;

  for (const value of [width, height, chunkLengths.length, splitHeight]) {
    header.set(writeU16LE(value), offset);
    offset += 2;
  }

  for (const len of chunkLengths) {
    header.set(writeU16LE(len), offset);
    offset += 2;
  }

  return header;
}

function buildCArraySource(
  bytes: Uint8Array,
  variableName: string,
  width: number,
  height: number
): string {
  const safeName = variableName.replace(/[^a-zA-Z0-9_]/g, "_") || "image";
  const lines: string[] = [
    "// LVGL SJPG C ARRAY",
    '#include "lvgl/lvgl.h"',
    "",
    `const uint8_t ${safeName}_map[] = {`,
  ];

  let line = "\t";
  for (let i = 0; i < bytes.length; i++) {
    line += `0x${bytes[i].toString(16).padStart(2, "0")},`;
    if ((i + 1) % 16 === 0) {
      lines.push(line);
      line = "\t";
    }
  }
  if (line.trim()) {
    lines.push(line);
  }

  lines.push(
    "};",
    "",
    `lv_image_dsc_t ${safeName} = {`,
    "\t.header.always_zero = 0,",
    `\t.header.w = ${width},`,
    `\t.header.h = ${height},`,
    `\t.data_size = ${bytes.length},`,
    "\t.header.cf = LV_IMG_CF_RAW,",
    `\t.data = ${safeName}_map,`,
    "};"
  );

  return lines.join("\n");
}

/** 将 Canvas 编码为 LVGL SJPG 二进制（与官方 jpg_to_sjpg.py 格式兼容） */
export async function encodeCanvasToSjpg(
  source: HTMLCanvasElement,
  options: SjpgEncodeOptions = {}
): Promise<SjpgEncodeResult> {
  const quality = options.quality ?? 0.9;
  const splitHeight = options.splitHeight ?? DEFAULT_SPLIT_HEIGHT;
  const variableName =
    options.variableName?.replace(/\.[^.]+$/, "") || "image";

  const width = source.width;
  const height = source.height;
  const splits = Math.ceil(height / splitHeight);
  const chunkLengths: number[] = [];
  const chunks: Uint8Array[] = [];

  const stripCanvas = document.createElement("canvas");
  stripCanvas.width = width;
  const stripCtx = stripCanvas.getContext("2d");
  if (!stripCtx) {
    throw new Error("Canvas 2D unavailable");
  }

  let rowRemaining = height;
  for (let i = 0; i < splits; i++) {
    const stripH = Math.min(splitHeight, rowRemaining);
    stripCanvas.height = stripH;
    stripCtx.clearRect(0, 0, width, stripH);
    stripCtx.drawImage(
      source,
      0,
      i * splitHeight,
      width,
      stripH,
      0,
      0,
      width,
      stripH
    );

    const jpeg = await canvasToJpegBytes(stripCanvas, quality);
    chunkLengths.push(jpeg.length);
    chunks.push(jpeg);
    rowRemaining -= splitHeight;
  }

  const header = buildHeader(width, height, splitHeight, chunkLengths);
  const totalSize =
    header.length + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(totalSize);
  bytes.set(header, 0);
  let offset = header.length;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  return {
    bytes,
    width,
    height,
    splits,
    splitHeight,
    cSource: buildCArraySource(bytes, variableName, width, height),
  };
}

/** 弹出保存对话框写入二进制；取消返回 null */
export async function saveBytesWithDialog(
  bytes: Uint8Array,
  defaultName: string,
  filters: { name: string; extensions: string[] }[]
): Promise<string | null> {
  const path = await save({
    defaultPath: defaultName,
    filters,
  });
  if (!path) {
    return null;
  }
  await writeFile(path, bytes);
  return path;
}

/** 弹出保存对话框写入文本；取消返回 null */
export async function saveTextWithDialog(
  text: string,
  defaultName: string,
  filters: { name: string; extensions: string[] }[]
): Promise<string | null> {
  return saveBytesWithDialog(
    new TextEncoder().encode(text),
    defaultName,
    filters
  );
}

/** 选择目录后批量写入；取消返回 null */
export async function saveFilesToPickedDir(
  files: { name: string; data: Uint8Array }[]
): Promise<string | null> {
  const dir = await open({
    directory: true,
    multiple: false,
  });
  if (!dir || Array.isArray(dir)) {
    return null;
  }
  for (const file of files) {
    await writeFile(await join(dir, file.name), file.data);
  }
  return dir;
}
