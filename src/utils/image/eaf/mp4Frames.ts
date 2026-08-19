import type { GifFrame } from "./types";
import { EAF_DEFAULT_SAMPLE_FPS, EAF_MAX_FRAMES } from "./types";

export interface Mp4ProbeResult {
  width: number;
  height: number;
  durationSec: number;
  frameCountEstimate: number;
  sampleFps: number;
  thumbnailUrl: string;
}

export interface ExtractMp4Options {
  sampleFps?: number;
  signal?: AbortSignal;
  onProgress?: (current: number, total: number, message: string) => void;
}

function yieldToUi() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function loadVideo(src: string, signal?: AbortSignal): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";

    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    const onMeta = () => {
      cleanup();
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        reject(new Error("无法读取视频时长"));
        return;
      }
      if (video.videoWidth <= 0 || video.videoHeight <= 0) {
        reject(new Error("无法读取视频尺寸"));
        return;
      }
      resolve(video);
    };

    const onError = () => {
      cleanup();
      reject(new Error("视频加载失败（请确认格式为浏览器可解码的 MP4）"));
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("error", onError);
    video.src = src;
  });
}

function seekVideo(
  video: HTMLVideoElement,
  time: number,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const target = Math.min(
      Math.max(0, time),
      Math.max(0, video.duration - 0.001)
    );

    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    const onSeeked = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("视频定位失败"));
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);

    if (Math.abs(video.currentTime - target) < 0.001) {
      cleanup();
      resolve();
      return;
    }
    video.currentTime = target;
  });
}

async function captureFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): Promise<ImageData> {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

async function captureThumbnailUrl(video: HTMLVideoElement): Promise<string> {
  await seekVideo(video, Math.min(0.05, video.duration * 0.02));
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D unavailable");
  }
  ctx.drawImage(video, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("缩略图生成失败"))),
      "image/jpeg",
      0.82
    );
  });
  return URL.createObjectURL(blob);
}

function buildSampleTimes(durationSec: number, sampleFps: number): number[] {
  const fps = Math.max(0.5, Math.min(60, sampleFps));
  const interval = 1 / fps;
  const raw: number[] = [];
  for (let t = 0; t < durationSec - 0.0005; t += interval) {
    raw.push(t);
    if (raw.length >= EAF_MAX_FRAMES) {
      break;
    }
  }
  if (raw.length === 0) {
    raw.push(0);
  } else {
    const last = raw[raw.length - 1];
    const end = Math.max(0, durationSec - 0.001);
    if (end - last > interval * 0.4 && raw.length < EAF_MAX_FRAMES) {
      raw.push(end);
    }
  }
  return raw;
}

export async function probeMp4(
  src: string,
  sampleFps: number = EAF_DEFAULT_SAMPLE_FPS,
  signal?: AbortSignal
): Promise<Mp4ProbeResult> {
  const video = await loadVideo(src, signal);
  try {
    const fps = Math.max(0.5, Math.min(60, sampleFps));
    const durationSec = video.duration;
    const frameCountEstimate = Math.min(
      EAF_MAX_FRAMES,
      Math.max(1, Math.ceil(durationSec * fps))
    );
    const thumbnailUrl = await captureThumbnailUrl(video);
    return {
      width: video.videoWidth,
      height: video.videoHeight,
      durationSec,
      frameCountEstimate,
      sampleFps: fps,
      thumbnailUrl,
    };
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}

export async function extractMp4Frames(
  src: string,
  options: ExtractMp4Options = {}
): Promise<GifFrame[]> {
  const sampleFps = options.sampleFps ?? EAF_DEFAULT_SAMPLE_FPS;
  const signal = options.signal;
  const video = await loadVideo(src, signal);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    video.removeAttribute("src");
    video.load();
    throw new Error("Canvas 2D unavailable");
  }

  try {
    const times = buildSampleTimes(video.duration, sampleFps);
    const delayMs = Math.max(20, Math.round(1000 / Math.max(0.5, sampleFps)));
    const frames: GifFrame[] = [];
    options.onProgress?.(0, times.length, "正在抽帧…");

    for (let i = 0; i < times.length; i++) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      await seekVideo(video, times[i], signal);
      const imageData = await captureFrame(video, canvas, ctx);
      frames.push({ imageData, delayMs });
      options.onProgress?.(
        i + 1,
        times.length,
        `抽帧 ${i + 1}/${times.length}`
      );
      if (i % 4 === 3) {
        await yieldToUi();
      }
    }

    if (frames.length === 0) {
      throw new Error("未能从视频中抽取任何帧");
    }
    return frames;
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}
