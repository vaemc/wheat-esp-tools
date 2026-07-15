/** EAF 编码模式，对应乐鑫在线转换器 */
export type EafEncodingMode = "rle" | "rle_huffman" | "jpeg";

/** 色深：RLE 系用 4/8，JPEG 固定 24 */
export type EafColorDepth = 4 | 8 | 24;

export interface EafEncodeOptions {
  width?: number;
  height?: number;
  splitHeight?: number;
  colorDepth?: EafColorDepth;
  encodingMode?: EafEncodingMode;
  /** JPEG 质量 11–100（与官方工具一致） */
  jpegQuality?: number;
}

export interface GifFrame {
  imageData: ImageData;
  /** 帧延时，毫秒 */
  delayMs: number;
}

export interface EafEncodeResult {
  bytes: Uint8Array;
  width: number;
  height: number;
  frameCount: number;
  splitHeight: number;
  colorDepth: EafColorDepth;
  encodingMode: EafEncodingMode;
  sizeBytes: number;
}

export interface EafFrameMeta {
  width: number;
  height: number;
  splitHeight: number;
  bitDepth: EafColorDepth;
  blockCount: number;
}

export interface EafDecodeResult {
  frames: HTMLCanvasElement[];
  width: number;
  height: number;
  frameCount: number;
  bitDepth: number;
  splitHeight: number;
}

export const EAF_DEFAULT_SPLIT_HEIGHT = 32;
export const EAF_DEFAULT_JPEG_QUALITY = 85;
export const EAF_DEFAULT_COLOR_DEPTH: EafColorDepth = 8;
export const EAF_DEFAULT_ENCODING: EafEncodingMode = "rle";
