export type {
  EafColorDepth,
  EafDecodeResult,
  EafEncodeOptions,
  EafEncodeResult,
  EafEncodingMode,
  GifFrame,
} from "./types";
export {
  EAF_DEFAULT_COLOR_DEPTH,
  EAF_DEFAULT_ENCODING,
  EAF_DEFAULT_FRAME_STEP,
  EAF_DEFAULT_JPEG_QUALITY,
  EAF_DEFAULT_SAMPLE_FPS,
  EAF_DEFAULT_SIMILAR_THRESHOLD,
  EAF_DEFAULT_SPLIT_HEIGHT,
  EAF_MAX_FRAMES,
} from "./types";
export {
  encodeFramesToEaf,
  encodeGifToEaf,
  type EncodeFramesProgress,
} from "./encode";
export { decodeEaf, isEafBytes, type DecodeEafOptions } from "./decode";
export { extractGifFrames } from "./gifFrames";
export {
  extractMp4Frames,
  probeMp4,
  type ExtractMp4Options,
  type Mp4ProbeResult,
} from "./mp4Frames";
