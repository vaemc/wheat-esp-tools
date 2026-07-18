/** 声道：保持源文件 / 强制单声道 / 强制立体声 */
export type ChannelMode = "keep" | "mono" | "stereo";

/**
 * Ogg 容器内的编码格式。
 * 同为 .ogg 后缀时，实际可能是 Opus / Vorbis / FLAC。
 */
export type OggCodec = "opus" | "vorbis" | "flac";

/** WAV → OGG 转换参数 */
export interface WavToOggOptions {
  /**
   * 编码格式，默认 opus。
   * 当前仅实现 Opus；Vorbis / FLAC 用于识别与预留。
   */
  codec?: OggCodec;
  /** 输出采样率 Hz，默认 16000（Opus） */
  sampleRate?: 8000 | 12000 | 16000 | 24000 | 48000;
  /** Opus 码率 kbps，默认 16 */
  bitrateKbps?: number;
  /**
   * 中间 PCM 位深（写入 Opus 前量化）。
   * Opus 本身为有损编码；此选项影响重采样后的量化精度。
   */
  bitDepth?: 16 | 24 | 32;
  /** 截取时长（秒）；不设则整段转换 */
  durationSec?: number | null;
  /** 声道调整，默认 mono（单声道） */
  channelMode?: ChannelMode;
  /**
   * Opus 编码复杂度，范围 0–10，默认 10。
   * 数值越大编码越精细、CPU 越高；与码率相互独立，几乎不影响文件体积。
   */
  complexity?: number;
  /** Opus 帧长 ms，默认 60 */
  frameDurationMs?: 2.5 | 5 | 10 | 20 | 40 | 60;
}

export interface WavProbeInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationSec: number;
  samplesPerChannel: number;
}

export interface WavToOggResult {
  bytes: Uint8Array;
  codec: OggCodec;
  sampleRate: number;
  channels: number;
  bitrateKbps: number;
  bitDepth: number;
  /** Opus complexity 0–10 */
  complexity: number;
  durationSec: number;
}

export const DEFAULT_WAV_TO_OGG_OPTIONS: Required<
  Omit<WavToOggOptions, "durationSec">
> & { durationSec: number | null } = {
  codec: "opus",
  sampleRate: 16000,
  bitrateKbps: 16,
  bitDepth: 16,
  durationSec: null,
  channelMode: "mono",
  complexity: 10,
  frameDurationMs: 60,
};

export function clampComplexity(value: number | undefined | null): number {
  if (value == null || Number.isNaN(value)) {
    return DEFAULT_WAV_TO_OGG_OPTIONS.complexity;
  }
  return Math.min(10, Math.max(0, Math.round(value)));
}

export function resolveChannelCount(
  mode: ChannelMode,
  sourceChannels: number
): 1 | 2 {
  if (mode === "mono") {
    return 1;
  }
  if (mode === "stereo") {
    return 2;
  }
  return sourceChannels >= 2 ? 2 : 1;
}
