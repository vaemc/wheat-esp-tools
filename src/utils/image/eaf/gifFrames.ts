import type { GifFrame } from "./types";
import { toArrayBuffer } from "./bytes";

export { toArrayBuffer } from "./bytes";

async function frameToImageData(frame: VideoFrame): Promise<ImageData> {
  const canvas = document.createElement("canvas");
  canvas.width = frame.displayWidth;
  canvas.height = frame.displayHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D unavailable");
  }
  ctx.drawImage(frame, 0, 0);
  frame.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

async function decodeWithImageDecoder(bytes: Uint8Array): Promise<GifFrame[]> {
  const decoder = new ImageDecoder({
    data: toArrayBuffer(bytes),
    type: "image/gif",
  });
  await decoder.tracks.ready;
  const track = decoder.tracks.selectedTrack;
  if (!track || track.frameCount <= 0) {
    decoder.close();
    throw new Error("No frames in GIF");
  }
  const frames: GifFrame[] = [];
  let prevTs = 0;
  for (let i = 0; i < track.frameCount; i++) {
    const result = await decoder.decode({ frameIndex: i });
    const image = result.image;
    const delayMs = Math.max(
      20,
      Math.round(((image.duration ?? 0) + (image.timestamp - prevTs)) / 1000) ||
        Math.round((image.duration ?? 100_000) / 1000)
    );
    prevTs = image.timestamp + (image.duration ?? 0);
    const imageData = await frameToImageData(image);
    frames.push({ imageData, delayMs });
  }
  decoder.close();
  return frames;
}

async function decodeFallbackSingle(bytes: Uint8Array): Promise<GifFrame[]> {
  const blob = new Blob([toArrayBuffer(bytes)], { type: "image/gif" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to load GIF"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D unavailable");
    }
    ctx.drawImage(img, 0, 0);
    return [
      {
        imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
        delayMs: 100,
      },
    ];
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 解码 GIF 全部帧（优先 ImageDecoder） */
export async function extractGifFrames(bytes: Uint8Array): Promise<GifFrame[]> {
  if (typeof ImageDecoder !== "undefined") {
    try {
      return await decodeWithImageDecoder(bytes);
    } catch {
      // fall through
    }
  }
  return decodeFallbackSingle(bytes);
}

export function resizeImageData(
  source: ImageData,
  width: number,
  height: number
): ImageData {
  if (source.width === width && source.height === height) {
    return source;
  }
  const src = document.createElement("canvas");
  src.width = source.width;
  src.height = source.height;
  const sctx = src.getContext("2d");
  if (!sctx) {
    throw new Error("Canvas 2D unavailable");
  }
  sctx.putImageData(source, 0, 0);

  const dst = document.createElement("canvas");
  dst.width = width;
  dst.height = height;
  const dctx = dst.getContext("2d");
  if (!dctx) {
    throw new Error("Canvas 2D unavailable");
  }
  dctx.imageSmoothingEnabled = true;
  dctx.imageSmoothingQuality = "high";
  dctx.drawImage(src, 0, 0, width, height);
  return dctx.getImageData(0, 0, width, height);
}

export function imageDataHash(data: ImageData): string {
  const { width, height, data: px } = data;
  let h = (width * 73856093) ^ (height * 19349663);
  const step = Math.max(1, Math.floor(px.length / 4096));
  for (let i = 0; i < px.length; i += step) {
    h = (h * 33 + px[i]) >>> 0;
  }
  return `${width}x${height}:${h.toString(16)}`;
}
