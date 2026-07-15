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
  EAF_DEFAULT_JPEG_QUALITY,
  EAF_DEFAULT_SPLIT_HEIGHT,
} from "./types";
export { encodeGifToEaf } from "./encode";
export { decodeEaf, isEafBytes, type DecodeEafOptions } from "./decode";
export { extractGifFrames } from "./gifFrames";

