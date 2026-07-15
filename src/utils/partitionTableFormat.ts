/** 分区表 CSV / 设备共用的类型名与地址格式化 */

const APP_TYPE = 0x00;
const DATA_TYPE = 0x01;
const BOOTLOADER_TYPE = 0x02;
const PARTITION_TABLE_TYPE = 0x03;

const TYPES: Record<string, number> = {
  app: APP_TYPE,
  data: DATA_TYPE,
  bootloader: BOOTLOADER_TYPE,
  partition_table: PARTITION_TABLE_TYPE,
};

const SUBTYPES: Record<number, Record<string, number>> = {
  [BOOTLOADER_TYPE]: { primary: 0x00, ota: 0x01, recovery: 0x02 },
  [PARTITION_TABLE_TYPE]: { primary: 0x00, ota: 0x01 },
  [APP_TYPE]: { factory: 0x00, test: 0x20 },
  [DATA_TYPE]: {
    ota: 0x00,
    phy: 0x01,
    nvs: 0x02,
    coredump: 0x03,
    nvs_keys: 0x04,
    efuse: 0x05,
    undefined: 0x06,
    esphttpd: 0x80,
    fat: 0x81,
    spiffs: 0x82,
    littlefs: 0x83,
    tee_ota: 0x90,
  },
};

for (let i = 0; i < 16; i++) {
  SUBTYPES[APP_TYPE][`ota_${i}`] = 0x10 + i;
}
for (let i = 0; i < 2; i++) {
  SUBTYPES[APP_TYPE][`tee_${i}`] = 0x30 + i;
}

function lookupName(value: number, keywords: Record<string, number>): string {
  for (const [name, num] of Object.entries(keywords)) {
    if (num === value) {
      return name;
    }
  }
  return `0x${value.toString(16)}`;
}

export function formatPartitionAddress(
  addr: number,
  allowSuffix: boolean
): string {
  if (allowSuffix) {
    if (addr % 0x100000 === 0) {
      return `${addr / 0x100000}M`;
    }
    if (addr % 0x400 === 0) {
      return `${addr / 0x400}K`;
    }
  }
  return `0x${addr.toString(16)}`;
}

/** 统计图副标题等：统一用 MB，避免 14300K / 14M 混用难读 */
export function formatPartitionMb(bytes: number, digits = 2): string {
  const mb = bytes / 0x100000;
  if (Number.isInteger(mb)) {
    return `${mb} MB`;
  }
  const fixed = mb.toFixed(digits).replace(/\.?0+$/, "");
  return `${fixed} MB`;
}

export function partitionTypeLabel(type: number): string {
  return lookupName(type, TYPES);
}

export function partitionSubtypeLabel(type: number, subtype: number): string {
  return lookupName(subtype, SUBTYPES[type] ?? {});
}

export { TYPES, SUBTYPES };
