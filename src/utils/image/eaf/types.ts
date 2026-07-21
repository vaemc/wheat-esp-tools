export type EafEncodingMode = "rle" | "rle_huffman" | "jpeg";

export type EafColorDepth = 4 | 8 | 24;

/** Options for the TS encoder mirror; batch convert uses Rust with the same fields. */
export interface EafEncodeOptions {
  width?: number;
  height?: number;
  /** 0 = full-frame strip */
  splitHeight?: number;
  colorDepth?: EafColorDepth;
  encodingMode?: EafEncodingMode;
  jpegQuality?: number;
  frameStep?: number;
  similarThreshold?: number;
}

export interface GifFrame {
  imageData: ImageData;
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
export const EAF_DEFAULT_COLOR_DEPTH: EafColorDepth = 24;
export const EAF_DEFAULT_ENCODING: EafEncodingMode = "jpeg";
export const EAF_DEFAULT_FRAME_STEP = 0;
export const EAF_DEFAULT_SIMILAR_THRESHOLD = 1;
