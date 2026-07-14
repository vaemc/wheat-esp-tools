/**
 * ESP-IDF otadata 解析 / 切换（对齐 components/app_update/otatool.py）
 */
import type { FlashPartition } from "@/utils/partitionBin";

const SPI_FLASH_SEC_SIZE = 0x2000;
const APP_TYPE = 0x00;
const DATA_TYPE = 0x01;
const OTADATA_SUBTYPE = 0x00;
const MIN_OTA_SUBTYPE = 0x10;
const NUM_OTA_SUBTYPES = 16;

export interface OtadataCopy {
  seq: number;
  crc: number;
  valid: boolean;
}

export interface OtadataInfo {
  copies: [OtadataCopy, OtadataCopy];
  /** 当前有效序列选出的 OTA 槽号；无法判定时为 null */
  activeSlot: number | null;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

/** 等同 Python binascii.crc32(data, value) */
function crc32(data: Uint8Array, value = 0): number {
  let crc = (value >>> 0) ^ 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function packU32LE(n: number): Uint8Array {
  const v = n >>> 0;
  return new Uint8Array([
    v & 0xff,
    (v >>> 8) & 0xff,
    (v >>> 16) & 0xff,
    (v >>> 24) & 0xff,
  ]);
}

function readU32LE(data: Uint8Array, offset: number): number {
  return (
    (data[offset] |
      (data[offset + 1] << 8) |
      (data[offset + 2] << 16) |
      (data[offset + 3] << 24)) >>>
    0
  );
}

/** otatool.py: crc32(pack('I', seq), 0xFFFFFFFF) */
function otaSeqCrc(seq: number): number {
  return crc32(packU32LE(seq >>> 0), 0xffffffff);
}

function isOtadataCopyValid(seq: number, crc: number): boolean {
  const s = seq >>> 0;
  return s < 0xffffffff && crc === otaSeqCrc(s);
}

export function findOtadataPartition(
  partitions: FlashPartition[]
): FlashPartition | null {
  const byName = partitions.find((p) => {
    const n = p.name.toLowerCase();
    return n === "otadata" || n === "ota_data";
  });
  if (byName) {
    return byName;
  }
  return (
    partitions.find(
      (p) => p.type === DATA_TYPE && p.subtype === OTADATA_SUBTYPE
    ) ?? null
  );
}

/** 连续的 ota_0..ota_N（遇缺即停） */
export function findOtaAppPartitions(
  partitions: FlashPartition[]
): FlashPartition[] {
  const list: FlashPartition[] = [];
  for (let i = 0; i < NUM_OTA_SUBTYPES; i++) {
    const subtype = MIN_OTA_SUBTYPE + i;
    const found = partitions.find(
      (p) => p.type === APP_TYPE && p.subtype === subtype
    );
    if (!found) {
      break;
    }
    list.push(found);
  }
  return list;
}

export function otaSlotOf(partition: FlashPartition): number {
  return partition.subtype - MIN_OTA_SUBTYPE;
}

export function parseOtadata(
  data: Uint8Array,
  otaPartitionCount: number,
  spiFlashSecSize = SPI_FLASH_SEC_SIZE
): OtadataInfo {
  const half = spiFlashSecSize >> 1;
  const copies: OtadataCopy[] = [];
  for (let i = 0; i < 2; i++) {
    const start = i * half;
    if (start + 32 > data.length) {
      copies.push({ seq: 0xffffffff, crc: 0xffffffff, valid: false });
      continue;
    }
    const seq = readU32LE(data, start);
    const crc = readU32LE(data, start + 28);
    copies.push({
      seq,
      crc,
      valid: isOtadataCopyValid(seq, crc),
    });
  }

  const [a, b] = copies as [OtadataCopy, OtadataCopy];
  let activeSeq: number | null = null;
  if (a.valid && b.valid) {
    activeSeq = a.seq >= b.seq ? a.seq : b.seq;
  } else if (a.valid) {
    activeSeq = a.seq;
  } else if (b.valid) {
    activeSeq = b.seq;
  }

  let activeSlot: number | null = null;
  if (activeSeq != null && otaPartitionCount > 0) {
    activeSlot = (activeSeq - 1) % otaPartitionCount;
  }

  return { copies: [a, b], activeSlot };
}

/**
 * 按 otatool.switch_ota_partition 生成下一份 otadata。
 * 写到「非当前 compute base」那一半副本上。
 */
export function buildSwitchedOtadata(
  current: Uint8Array,
  targetPartition: FlashPartition,
  otaPartitions: FlashPartition[],
  spiFlashSecSize = SPI_FLASH_SEC_SIZE
): Uint8Array {
  if (otaPartitions.length === 0) {
    throw new Error("NO_OTA_APP");
  }

  const info = parseOtadata(current, otaPartitions.length, spiFlashSecSize);
  const [c0, c1] = info.copies;

  let computeBase = -1;
  if (c0.valid && c1.valid) {
    computeBase = c0.seq >= c1.seq ? 0 : 1;
  } else if (c0.valid) {
    computeBase = 0;
  } else if (c1.valid) {
    computeBase = 1;
  }

  const otaPartitionsNum = otaPartitions.length;
  const targetSeq = (targetPartition.subtype & 0x0f) + 1;

  let otaSeqNext = targetSeq;
  if (computeBase === 0 || computeBase === 1) {
    const baseSeq = info.copies[computeBase].seq >>> 0;
    let i = 0;
    while (baseSeq > (targetSeq % otaPartitionsNum) + i * otaPartitionsNum) {
      i += 1;
    }
    otaSeqNext = (targetSeq % otaPartitionsNum) + i * otaPartitionsNum;
  }

  const seqBytes = packU32LE(otaSeqNext);
  const crcBytes = packU32LE(otaSeqCrc(otaSeqNext));
  const half = spiFlashSecSize >> 1;
  const outLen = Math.max(current.length, spiFlashSecSize);
  const out = new Uint8Array(outLen);
  out.fill(0xff);
  out.set(current.subarray(0, Math.min(current.length, outLen)));

  const writeStart = (computeBase === 0 ? 1 : 0) * half;
  out.set(seqBytes, writeStart);
  out.set(crcBytes, writeStart + 28);

  return out;
}
