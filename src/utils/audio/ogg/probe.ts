import type { OggCodec } from "./types";

/** 从 Ogg 容器读取编码格式与基础信息 */

export interface OggProbeInfo {
  codec: OggCodec;
  sampleRate: number;
  channels: number;
  preSkip: number;
  /** 文件字节数 */
  byteLength: number;
}

function readAscii(bytes: Uint8Array, offset: number, length: number) {
  let s = "";
  for (let i = 0; i < length; i++) {
    s += String.fromCharCode(bytes[offset + i] ?? 0);
  }
  return s;
}

function readU16LE(bytes: Uint8Array, offset: number) {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readU32LE(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16) |
    ((bytes[offset + 3] ?? 0) << 24)
  ) >>> 0;
}

function* iterateOggPackets(view: Uint8Array): Generator<Uint8Array> {
  let offset = 0;
  while (offset + 27 < view.length) {
    if (readAscii(view, offset, 4) !== "OggS") {
      offset += 1;
      continue;
    }
    const segmentCount = view[offset + 26] ?? 0;
    const tableStart = offset + 27;
    if (tableStart + segmentCount > view.length) {
      break;
    }
    let bodySize = 0;
    for (let i = 0; i < segmentCount; i++) {
      bodySize += view[tableStart + i] ?? 0;
    }
    const bodyStart = tableStart + segmentCount;
    if (bodyStart + bodySize > view.length) {
      break;
    }
    // Ogg 一页可含多个逻辑包；此处按整页 body 做识别头扫描足够
    yield view.subarray(bodyStart, bodyStart + bodySize);
    offset = bodyStart + bodySize;
  }
}

function detectCodecFromPacket(packet: Uint8Array): OggCodec | null {
  if (packet.length >= 8 && readAscii(packet, 0, 8) === "OpusHead") {
    return "opus";
  }
  // Vorbis identification: 0x01 + "vorbis"
  if (
    packet.length >= 7 &&
    packet[0] === 0x01 &&
    readAscii(packet, 1, 6) === "vorbis"
  ) {
    return "vorbis";
  }
  // Ogg FLAC mapping: 0x7F + "FLAC"
  if (
    packet.length >= 5 &&
    packet[0] === 0x7f &&
    readAscii(packet, 1, 4) === "FLAC"
  ) {
    return "flac";
  }
  return null;
}

function parseOpusHead(packet: Uint8Array, byteLength: number): OggProbeInfo {
  return {
    codec: "opus",
    channels: packet[9] ?? 1,
    preSkip: readU16LE(packet, 10),
    sampleRate: readU32LE(packet, 12),
    byteLength,
  };
}

function parseVorbisIdent(packet: Uint8Array, byteLength: number): OggProbeInfo {
  // 0x01 + "vorbis"(6) + version(4) + channels(1) + sample_rate(4)
  return {
    codec: "vorbis",
    channels: packet[11] ?? 1,
    preSkip: 0,
    sampleRate: packet.length >= 16 ? readU32LE(packet, 12) : 0,
    byteLength,
  };
}

function parseFlacOgg(packet: Uint8Array, byteLength: number): OggProbeInfo {
  // 0x7F FLAC + major/minor + header count，其后常跟 fLaC + STREAMINFO
  let sampleRate = 0;
  let channels = 1;
  const flacMagic = readAscii(packet, 5, 4) === "fLaC" ? 5 : -1;
  const streamInfoAt =
    flacMagic >= 0 && packet.length > flacMagic + 4 + 4 + 18
      ? flacMagic + 4
      : -1;
  // STREAMINFO: sample rate 20 bits @ data+10, channels in following bits
  if (streamInfoAt >= 0) {
    const data = streamInfoAt + 4;
    if (packet.length >= data + 18) {
      const b10 = packet[data + 10] ?? 0;
      const b11 = packet[data + 11] ?? 0;
      const b12 = packet[data + 12] ?? 0;
      sampleRate = (b10 << 12) | (b11 << 4) | (b12 >> 4);
      channels = ((b12 >> 1) & 0x07) + 1;
    }
  }
  return {
    codec: "flac",
    channels,
    preSkip: 0,
    sampleRate,
    byteLength,
  };
}

/** 识别 Ogg 内编码（Opus / Vorbis / FLAC）并解析基础字段 */
export function probeOgg(bytes: Uint8Array): OggProbeInfo {
  for (const packet of iterateOggPackets(bytes)) {
    const codec = detectCodecFromPacket(packet);
    if (codec === "opus" && packet.length >= 19) {
      return parseOpusHead(packet, bytes.length);
    }
    if (codec === "vorbis" && packet.length >= 12) {
      return parseVorbisIdent(packet, bytes.length);
    }
    if (codec === "flac") {
      return parseFlacOgg(packet, bytes.length);
    }
  }
  throw new Error("NOT_OGG");
}
