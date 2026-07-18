/**
 * 将 Opus 裸包封装为 Ogg Opus（RFC 7845）。
 * granule 按 48 kHz 计时，与编码器内部采样率无关。
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) {
      r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    }
    table[i] = r >>> 0;
  }
  return table;
})();

function crcOgg(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ data[i]!) & 0xff]!) >>> 0;
  }
  return crc >>> 0;
}

function writePage(
  packets: Uint8Array[],
  serial: number,
  pageSeq: number,
  granule: bigint,
  headerType: number
): Uint8Array {
  const bodyLen = packets.reduce((n, p) => n + p.length, 0);
  const segmentTable: number[] = [];
  for (const packet of packets) {
    let remaining = packet.length;
    while (remaining >= 255) {
      segmentTable.push(255);
      remaining -= 255;
    }
    segmentTable.push(remaining);
  }

  const headerSize = 27 + segmentTable.length;
  const page = new Uint8Array(headerSize + bodyLen);
  const view = new DataView(page.buffer);

  page[0] = 0x4f; // O
  page[1] = 0x67; // g
  page[2] = 0x67; // g
  page[3] = 0x53; // S
  page[4] = 0; // version
  page[5] = headerType;
  view.setBigUint64(6, granule, true);
  view.setUint32(14, serial, true);
  view.setUint32(18, pageSeq, true);
  view.setUint32(22, 0, true); // checksum placeholder
  page[26] = segmentTable.length;
  page.set(segmentTable, 27);

  let offset = headerSize;
  for (const packet of packets) {
    page.set(packet, offset);
    offset += packet.length;
  }

  view.setUint32(22, crcOgg(page), true);
  return page;
}

function buildOpusHead(
  channels: number,
  inputSampleRate: number,
  preSkip: number
): Uint8Array {
  const head = new Uint8Array(19);
  const view = new DataView(head.buffer);
  head.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0); // OpusHead
  head[8] = 1;
  head[9] = channels;
  view.setUint16(10, preSkip, true);
  view.setUint32(12, inputSampleRate, true);
  view.setInt16(16, 0, true);
  head[18] = 0;
  return head;
}

function buildOpusTags(vendor = "wheat-esp-tools"): Uint8Array {
  const v = new TextEncoder().encode(vendor);
  const tags = new Uint8Array(8 + 4 + v.length + 4);
  const view = new DataView(tags.buffer);
  tags.set([0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73], 0); // OpusTags
  view.setUint32(8, v.length, true);
  tags.set(v, 12);
  view.setUint32(12 + v.length, 0, true);
  return tags;
}

export function muxOpusPacketsToOgg(options: {
  packets: Uint8Array[];
  channels: number;
  inputSampleRate: number;
  preSkip: number;
  /** 每包对应的 48 kHz 样本数（如 60ms → 2880） */
  granulePerPacket: number;
  serial?: number;
}): Uint8Array {
  const {
    packets,
    channels,
    inputSampleRate,
    preSkip,
    granulePerPacket,
    serial = 0xc0dec0de,
  } = options;

  if (!packets.length) {
    throw new Error("EMPTY_OPUS");
  }

  const pages: Uint8Array[] = [];
  let pageSeq = 0;

  pages.push(
    writePage(
      [buildOpusHead(channels, inputSampleRate, preSkip)],
      serial,
      pageSeq++,
      0n,
      0x02 // BOS
    )
  );
  pages.push(
    writePage([buildOpusTags()], serial, pageSeq++, 0n, 0x00)
  );

  let granule = 0n;
  for (let i = 0; i < packets.length; i++) {
    granule += BigInt(granulePerPacket);
    const isLast = i === packets.length - 1;
    pages.push(
      writePage(
        [packets[i]!],
        serial,
        pageSeq++,
        granule,
        isLast ? 0x04 : 0x00
      )
    );
  }

  let total = 0;
  for (const p of pages) {
    total += p.length;
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of pages) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
