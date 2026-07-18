/** 从 Ogg Opus 容器读取基础信息（RFC 7845 OpusHead） */

export interface OggOpusProbeInfo {
  sampleRate: number;
  channels: number;
  preSkip: number;
  /** 文件字节数 */
  byteLength: number;
  isOpus: boolean;
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

/** 在字节流中查找 OpusHead 包并解析 */
export function probeOggOpus(bytes: Uint8Array): OggOpusProbeInfo {
  const view = bytes;
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
    if (
      bodySize >= 19 &&
      readAscii(view, bodyStart, 8) === "OpusHead"
    ) {
      return {
        isOpus: true,
        channels: view[bodyStart + 9] ?? 1,
        preSkip: readU16LE(view, bodyStart + 10),
        sampleRate: readU32LE(view, bodyStart + 12),
        byteLength: view.length,
      };
    }
    offset = bodyStart + bodySize;
  }

  throw new Error("NOT_OGG_OPUS");
}
