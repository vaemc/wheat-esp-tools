/** ESP-IDF 分区表二进制解析（单条 32 字节） */

const PARTITION_ENTRY_SIZE = 32;
const PARTITION_MAGIC = 0x50aa;
const DATA_TYPE = 0x01;
const NVS_SUBTYPE = 0x02;

export interface FlashPartition {
  name: string;
  type: number;
  subtype: number;
  offset: number;
  size: number;
}

function readU32LE(data: Uint8Array, offset: number): number {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  ) >>> 0;
}

/** 解析从 Flash 读取的分区表二进制 */
export function parsePartitionTableBinary(buffer: Uint8Array): FlashPartition[] {
  const partitions: FlashPartition[] = [];

  for (let i = 0; i + PARTITION_ENTRY_SIZE <= buffer.length; i += PARTITION_ENTRY_SIZE) {
    const magic = buffer[i] | (buffer[i + 1] << 8);
    if (magic !== PARTITION_MAGIC) {
      if (magic === 0xffff || buffer[i] === 0xff) {
        break;
      }
      continue;
    }

    const type = buffer[i + 2];
    const subtype = buffer[i + 3];
    const offset = readU32LE(buffer, i + 4);
    const size = readU32LE(buffer, i + 8);
    const nameBytes = buffer.slice(i + 12, i + 28);
    const nameEnd = nameBytes.indexOf(0);
    const name = new TextDecoder()
      .decode(nameEnd >= 0 ? nameBytes.slice(0, nameEnd) : nameBytes)
      .trim();

    if (size === 0 && type === 0xff) {
      break;
    }

    partitions.push({ name, type, subtype, offset, size });
  }

  return partitions;
}

/** 查找 NVS 分区：优先名称 nvs，否则 data/nvs 子类型 */
export function findNvsPartition(
  partitions: FlashPartition[]
): FlashPartition | null {
  const byName = partitions.find((p) => p.name.toLowerCase() === "nvs");
  if (byName) {
    return byName;
  }
  return (
    partitions.find((p) => p.type === DATA_TYPE && p.subtype === NVS_SUBTYPE) ??
    null
  );
}

/** 格式化为 esptool 参数（v5+ 要求整数/0x 十六进制，不支持 32K 简写） */
export function formatHexForEsptool(value: number): string {
  return `0x${value.toString(16)}`;
}

/** 解析 0x / K / M 等为字节数 */
export function parseSizeParam(value: string): number {
  const v = value.trim().toLowerCase();
  if (!v) {
    return 0;
  }
  if (v.endsWith("k")) {
    return parseInt(v.slice(0, -1), v.startsWith("0x") ? 16 : 10) * 1024;
  }
  if (v.endsWith("m")) {
    return parseInt(v.slice(0, -1), v.startsWith("0x") ? 16 : 10) * 1024 * 1024;
  }
  return parseInt(v, v.startsWith("0x") ? 16 : 10);
}

/** 界面展示用（可读性更好的 K/M 简写） */
export function formatHexDisplay(value: number): string {
  if (value >= 0x100000 && value % 0x100000 === 0) {
    return `${value / 0x100000}M`;
  }
  if (value >= 0x400 && value % 0x400 === 0) {
    return `${value / 0x400}K`;
  }
  return formatHexForEsptool(value);
}
