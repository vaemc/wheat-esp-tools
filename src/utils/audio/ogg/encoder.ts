import {
  Application,
  createEncoder,
  type SampleRate,
} from "libopus-wasm";
import { muxOpusPacketsToOgg } from "./oggMux";
import {
  DEFAULT_WAV_TO_OGG_OPTIONS,
  clampComplexity,
  resolveChannelCount,
  type WavToOggOptions,
  type WavToOggResult,
} from "./types";
import { decodeWav, floatToInt16, resampleInterleaved } from "./wav";

function resolveOptions(options?: WavToOggOptions) {
  return {
    sampleRate: (options?.sampleRate ??
      DEFAULT_WAV_TO_OGG_OPTIONS.sampleRate) as SampleRate,
    bitrateKbps: options?.bitrateKbps ?? DEFAULT_WAV_TO_OGG_OPTIONS.bitrateKbps,
    bitDepth: options?.bitDepth ?? DEFAULT_WAV_TO_OGG_OPTIONS.bitDepth,
    durationSec:
      options?.durationSec === undefined
        ? DEFAULT_WAV_TO_OGG_OPTIONS.durationSec
        : options.durationSec,
    channelMode:
      options?.channelMode ?? DEFAULT_WAV_TO_OGG_OPTIONS.channelMode,
    complexity: clampComplexity(options?.complexity),
    frameDurationMs:
      options?.frameDurationMs ?? DEFAULT_WAV_TO_OGG_OPTIONS.frameDurationMs,
  };
}

/**
 * WAV → OGG Opus。
 * 默认：16kbps / 16kHz / 单声道 / complexity=10 / frame_duration=60。
 */
export async function convertWavToOgg(
  wavBytes: ArrayBuffer | Uint8Array,
  options?: WavToOggOptions
): Promise<WavToOggResult> {
  const opts = resolveOptions(options);
  const buffer =
    wavBytes instanceof ArrayBuffer
      ? wavBytes
      : wavBytes.buffer.slice(
          wavBytes.byteOffset,
          wavBytes.byteOffset + wavBytes.byteLength
        );

  const wav = decodeWav(buffer as ArrayBuffer);
  const outChannels = resolveChannelCount(opts.channelMode, wav.channels);

  const pcmFloat = resampleInterleaved(
    wav.samples,
    wav.sampleRate,
    wav.channels,
    opts.sampleRate,
    outChannels,
    opts.durationSec
  );
  const pcm = floatToInt16(pcmFloat, opts.bitDepth);

  const frameSamples = Math.round(
    (opts.sampleRate * opts.frameDurationMs) / 1000
  );
  const frameInterleaved = frameSamples * outChannels;
  const granulePerPacket = Math.round(48000 * (opts.frameDurationMs / 1000));

  const bitrateBps = Math.round(opts.bitrateKbps * 1000);
  const encoder = await createEncoder({
    sampleRate: opts.sampleRate,
    channels: outChannels,
    application: Application.Voip,
    bitrate: bitrateBps,
    frameSize: frameSamples,
    vbr: false,
    complexity: opts.complexity,
  });

  try {
    // 再设一次，避免部分实现忽略 create 时的 bitrate
    encoder.setBitrate(bitrateBps);
    try {
      encoder.encoderCtl(4036, opts.bitDepth);
    } catch {
      /* optional */
    }

    const packets: Uint8Array[] = [];
    const frame = new Int16Array(frameInterleaved);
    let offset = 0;
    while (offset < pcm.length) {
      frame.fill(0);
      const take = Math.min(frameInterleaved, pcm.length - offset);
      frame.set(pcm.subarray(offset, offset + take));
      offset += take;
      packets.push(encoder.encode(frame));
    }

    if (!packets.length) {
      throw new Error("EMPTY_AUDIO");
    }

    const preSkip = encoder.getLookahead();
    const preSkip48 = Math.round((preSkip * 48000) / opts.sampleRate);

    const bytes = muxOpusPacketsToOgg({
      packets,
      channels: outChannels,
      inputSampleRate: opts.sampleRate,
      preSkip: preSkip48,
      granulePerPacket,
    });

    const durationSec = pcmFloat.length / outChannels / opts.sampleRate;
    return {
      bytes,
      sampleRate: opts.sampleRate,
      channels: outChannels,
      bitrateKbps: opts.bitrateKbps,
      bitDepth: opts.bitDepth,
      complexity: opts.complexity,
      durationSec,
    };
  } finally {
    encoder.free();
  }
}
