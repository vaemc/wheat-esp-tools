import type { WavProbeInfo } from "./types";

export interface DecodedWav {
  /** 交错 Float32，范围约 [-1, 1] */
  samples: Float32Array;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

const WAVE_FORMAT_PCM = 0x0001;
const WAVE_FORMAT_IEEE_FLOAT = 0x0003;
const WAVE_FORMAT_EXTENSIBLE = 0xfffe;

/** PCM / IEEE float 的 WAVE_FORMAT_EXTENSIBLE SubFormat GUID（前 4 字节为 format tag） */
function extensibleSubFormatTag(view: DataView, fmtChunkStart: number): number {
  // fmt 扩展区：18 字节基础后还有 cbSize；SubFormat 通常在 chunkStart+24
  if (view.byteLength < fmtChunkStart + 28) {
    return 0;
  }
  return view.getUint16(fmtChunkStart + 24, true);
}

function readAscii(view: DataView, offset: number, length: number) {
  let s = "";
  for (let i = 0; i < length; i++) {
    s += String.fromCharCode(view.getUint8(offset + i));
  }
  return s;
}

/** 解析 PCM / IEEE float WAV（含 WAVE_FORMAT_EXTENSIBLE） */
export function decodeWav(buffer: ArrayBuffer): DecodedWav {
  const view = new DataView(buffer);
  if (buffer.byteLength < 12 || readAscii(view, 0, 4) !== "RIFF") {
    throw new Error("NOT_WAV");
  }
  if (readAscii(view, 8, 4) !== "WAVE") {
    throw new Error("NOT_WAV");
  }

  let offset = 12;
  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataSize = 0;
  let fmtChunkStart = -1;

  while (offset + 8 <= view.byteLength) {
    const id = readAscii(view, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    // 防止坏 size 导致死循环 / 越界
    if (chunkStart > view.byteLength || chunkStart + size > view.byteLength) {
      if (id === "data" && chunkStart <= view.byteLength) {
        dataOffset = chunkStart;
        dataSize = view.byteLength - chunkStart;
      }
      break;
    }
    if (id === "fmt " && size >= 16) {
      fmtChunkStart = chunkStart;
      audioFormat = view.getUint16(chunkStart, true);
      channels = view.getUint16(chunkStart + 2, true);
      sampleRate = view.getUint32(chunkStart + 4, true);
      bitsPerSample = view.getUint16(chunkStart + 14, true);
    } else if (id === "data") {
      dataOffset = chunkStart;
      dataSize = size;
      // 继续扫完也可以，但 data 后通常结束
      if (fmtChunkStart >= 0) {
        break;
      }
    }
    offset = chunkStart + size + (size % 2);
  }

  if (audioFormat === WAVE_FORMAT_EXTENSIBLE && fmtChunkStart >= 0) {
    const tag = extensibleSubFormatTag(view, fmtChunkStart);
    if (tag === WAVE_FORMAT_PCM || tag === WAVE_FORMAT_IEEE_FLOAT) {
      audioFormat = tag;
    }
  }

  if (
    dataOffset < 0 ||
    !channels ||
    !sampleRate ||
    !bitsPerSample ||
    (audioFormat !== WAVE_FORMAT_PCM && audioFormat !== WAVE_FORMAT_IEEE_FLOAT)
  ) {
    throw new Error("UNSUPPORTED_WAV");
  }

  const bytesPerSample = bitsPerSample / 8;
  if (!Number.isInteger(bytesPerSample) || bytesPerSample <= 0) {
    throw new Error("UNSUPPORTED_WAV");
  }

  // 部分文件 data size 写成 0xFFFFFFFF，按剩余字节估算
  let usable = dataSize;
  if (usable === 0xffffffff || dataOffset + usable > view.byteLength) {
    usable = view.byteLength - dataOffset;
  }

  const frameCount = Math.floor(usable / (bytesPerSample * channels));
  if (frameCount <= 0) {
    throw new Error("UNSUPPORTED_WAV");
  }

  const samples = new Float32Array(frameCount * channels);
  let p = dataOffset;
  const isFloat = audioFormat === WAVE_FORMAT_IEEE_FLOAT;

  for (let i = 0; i < frameCount * channels; i++) {
    if (isFloat && bitsPerSample === 32) {
      samples[i] = view.getFloat32(p, true);
      p += 4;
    } else if (bitsPerSample === 8) {
      samples[i] = (view.getUint8(p) - 128) / 128;
      p += 1;
    } else if (bitsPerSample === 16) {
      samples[i] = view.getInt16(p, true) / 32768;
      p += 2;
    } else if (bitsPerSample === 24) {
      const b0 = view.getUint8(p);
      const b1 = view.getUint8(p + 1);
      const b2 = view.getUint8(p + 2);
      let n = (b2 << 16) | (b1 << 8) | b0;
      if (n & 0x800000) {
        n |= ~0xffffff;
      }
      samples[i] = n / 8388608;
      p += 3;
    } else if (bitsPerSample === 32 && !isFloat) {
      samples[i] = view.getInt32(p, true) / 2147483648;
      p += 4;
    } else {
      throw new Error("UNSUPPORTED_WAV");
    }
  }

  return { samples, sampleRate, channels, bitsPerSample };
}

export function probeWav(buffer: ArrayBuffer): WavProbeInfo {
  const wav = decodeWav(buffer);
  const samplesPerChannel = Math.floor(wav.samples.length / wav.channels);
  return {
    sampleRate: wav.sampleRate,
    channels: wav.channels,
    bitsPerSample: wav.bitsPerSample,
    durationSec: samplesPerChannel / wav.sampleRate,
    samplesPerChannel,
  };
}

/** 线性重采样 + 混音/抽声道，输出交错 Float32 */
export function resampleInterleaved(
  input: Float32Array,
  inRate: number,
  inChannels: number,
  outRate: number,
  outChannels: 1 | 2,
  maxDurationSec: number | null
): Float32Array {
  const inFrames = Math.floor(input.length / inChannels);
  let outFrames = Math.max(1, Math.round((inFrames * outRate) / inRate));
  if (maxDurationSec != null && maxDurationSec > 0) {
    outFrames = Math.min(outFrames, Math.floor(maxDurationSec * outRate));
  }

  const out = new Float32Array(outFrames * outChannels);
  const ratio = inRate / outRate;

  for (let i = 0; i < outFrames; i++) {
    const srcPos = i * ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, inFrames - 1);
    const t = srcPos - i0;

    const readCh = (frame: number, ch: number) => {
      const c = Math.min(ch, inChannels - 1);
      return input[frame * inChannels + c] ?? 0;
    };

    if (outChannels === 1) {
      let s0 = 0;
      let s1 = 0;
      for (let c = 0; c < inChannels; c++) {
        s0 += readCh(i0, c);
        s1 += readCh(i1, c);
      }
      s0 /= inChannels;
      s1 /= inChannels;
      out[i] = s0 + (s1 - s0) * t;
    } else {
      for (let c = 0; c < 2; c++) {
        const a = readCh(i0, c);
        const b = readCh(i1, c);
        out[i * 2 + c] = a + (b - a) * t;
      }
    }
  }

  return out;
}

/** Float32 → Int16，按目标位深做量化台阶（再落到 16-bit PCM 供 Opus） */
export function floatToInt16(
  samples: Float32Array,
  bitDepth: 16 | 24 | 32
): Int16Array {
  const out = new Int16Array(samples.length);
  const levels =
    bitDepth === 16 ? 32768 : bitDepth === 24 ? 8388608 : 2147483648;

  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i] ?? 0));
    const quantized = Math.round(x * (levels - 1)) / (levels - 1);
    out[i] = Math.max(-32768, Math.min(32767, Math.round(quantized * 32767)));
  }
  return out;
}
