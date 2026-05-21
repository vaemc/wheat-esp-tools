/** ESP-IDF 分区表 CSV 解析与偏移量计算（对齐 gen_esp32part.py 核心逻辑） */

const APP_TYPE = 0x00;
const DATA_TYPE = 0x01;
const BOOTLOADER_TYPE = 0x02;
const PARTITION_TABLE_TYPE = 0x03;

export const PARTITION_TABLE_SIZE = 0x1000;
export const DEFAULT_OFFSET_PART_TABLE = 0x8000;

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

const ALIGNMENT: Record<number, number> = {
  [APP_TYPE]: 0x10000,
  [DATA_TYPE]: 0x1000,
  [BOOTLOADER_TYPE]: 0x1000,
  [PARTITION_TABLE_TYPE]: 0x1000,
};

export class PartitionTableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartitionTableError";
  }
}

export interface PartitionEntry {
  name: string;
  type: number;
  subtype: number;
  offset: number | null;
  size: number;
  flags: string;
  lineNo: number;
}

export interface PartitionRow {
  key: string;
  name: string;
  type: string;
  subtype: string;
  offset: string;
  size: string;
  flags: string;
}

export interface PartitionTableResult {
  rows: PartitionRow[];
  csv: string;
  totalSizeMb: string;
}

function getAlignmentForType(type: number): number {
  return ALIGNMENT[type] ?? ALIGNMENT[DATA_TYPE];
}

function parseIntField(
  value: string,
  keywords: Record<string, number> = {}
): number {
  const v = value.trim();
  if (!v) {
    throw new PartitionTableError("字段不能为空");
  }
  const lower = v.toLowerCase();
  for (const suffix of ["k", "m"] as const) {
    if (lower.endsWith(suffix)) {
      const num = parseIntField(v.slice(0, -1), keywords);
      return num * (suffix === "k" ? 1024 : 1024 * 1024);
    }
  }
  if (/^0x[0-9a-f]+$/i.test(v) || /^-?0x/i.test(v)) {
    return parseInt(v, 16);
  }
  if (/^\d+$/.test(v)) {
    return parseInt(v, 10);
  }
  const key = lower in keywords ? lower : v;
  if (key in keywords) {
    return keywords[key];
  }
  throw new PartitionTableError(`无效的值: ${value}`);
}

function parseType(value: string): number {
  if (!value.trim()) {
    throw new PartitionTableError("type 不能为空");
  }
  return parseIntField(value, TYPES);
}

function parseSubtype(value: string, type: number): number {
  if (!value.trim()) {
    if (type === APP_TYPE) {
      throw new PartitionTableError("app 分区的 subtype 不能为空");
    }
    return SUBTYPES[DATA_TYPE].undefined;
  }
  return parseIntField(value, SUBTYPES[type] ?? {});
}

function parseSize(value: string): number {
  if (!value.trim()) {
    throw new PartitionTableError("size 不能为空");
  }
  return parseIntField(value);
}

function parseOffset(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  return parseIntField(value);
}

function lookupName(value: number, keywords: Record<string, number>): string {
  for (const [name, num] of Object.entries(keywords)) {
    if (num === value) {
      return name;
    }
  }
  return `0x${value.toString(16)}`;
}

function formatAddress(addr: number, allowSuffix: boolean): string {
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

function alignUp(value: number, alignment: number): number {
  if (value % alignment === 0) {
    return value;
  }
  return value + alignment - (value % alignment);
}

function parseCsvLines(csv: string): PartitionEntry[] {
  const entries: PartitionEntry[] = [];
  const lines = csv.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith("#")) {
      continue;
    }

    const lineNo = i + 1;
    const fields = `${raw},,,,,`.split(",").map((f) => f.trim());
    const [name, typeStr, subtypeStr, offsetStr, sizeStr, flagsStr] = fields;

    if (!name) {
      throw new PartitionTableError(`第 ${lineNo} 行: 分区名不能为空`);
    }

    const type = parseType(typeStr);
    const subtype = parseSubtype(subtypeStr, type);
    const offset = parseOffset(offsetStr);
    const size = parseSize(sizeStr);

    entries.push({
      name,
      type,
      subtype,
      offset,
      size,
      flags: flagsStr ?? "",
      lineNo,
    });
  }

  if (entries.length === 0) {
    throw new PartitionTableError("未找到有效的分区行");
  }

  return entries;
}

function calculateOffsets(
  entries: PartitionEntry[],
  offsetPartTable = DEFAULT_OFFSET_PART_TABLE
): void {
  let lastEnd = offsetPartTable + PARTITION_TABLE_SIZE;

  for (const entry of entries) {
    const isBootloader =
      entry.type === BOOTLOADER_TYPE &&
      entry.subtype === SUBTYPES[BOOTLOADER_TYPE].primary;
    const isPartitionTable =
      entry.type === PARTITION_TABLE_TYPE &&
      entry.subtype === SUBTYPES[PARTITION_TABLE_TYPE].primary;

    if (isBootloader || isPartitionTable) {
      continue;
    }

    if (entry.offset !== null && entry.offset < lastEnd) {
      throw new PartitionTableError(
        `第 ${entry.lineNo} 行: 分区偏移 0x${entry.offset.toString(16)} 与上一分区结束位置 0x${lastEnd.toString(16)} 重叠`
      );
    }

    if (entry.offset === null) {
      lastEnd = alignUp(lastEnd, getAlignmentForType(entry.type));
      entry.offset = lastEnd;
    }

    if (entry.size < 0) {
      entry.size = -entry.size - entry.offset;
    }

    lastEnd = entry.offset + entry.size;
  }

  for (const entry of entries) {
    if (entry.offset === null) {
      throw new PartitionTableError(`第 ${entry.lineNo} 行: 未能计算偏移量`);
    }
  }
}

const CSV_COLUMNS = [
  "name",
  "type",
  "subtype",
  "offset",
  "size",
  "flags",
] as const;

type CsvColumn = (typeof CSV_COLUMNS)[number];

interface CsvLineFields {
  name: string;
  type: string;
  subtype: string;
  offset: string;
  size: string;
  flags: string;
}

function entryToFields(entry: PartitionEntry): CsvLineFields {
  return {
    name: entry.name,
    type: lookupName(entry.type, TYPES),
    subtype: lookupName(entry.subtype, SUBTYPES[entry.type] ?? {}),
    offset: formatAddress(entry.offset!, false),
    size: formatAddress(entry.size, true),
    flags: entry.flags,
  };
}

function columnWidths(rows: CsvLineFields[]): Record<CsvColumn, number> {
  const headers: CsvLineFields = {
    name: "Name",
    type: "Type",
    subtype: "SubType",
    offset: "Offset",
    size: "Size",
    flags: "Flags",
  };
  const widths = {} as Record<CsvColumn, number>;
  for (const col of CSV_COLUMNS) {
    widths[col] = headers[col].length;
  }
  for (const row of rows) {
    for (const col of CSV_COLUMNS) {
      widths[col] = Math.max(widths[col], row[col].length);
    }
  }
  return widths;
}

function formatAlignedRow(
  fields: CsvLineFields,
  widths: Record<CsvColumn, number>
): string {
  return CSV_COLUMNS.map((col) => fields[col].padEnd(widths[col])).join(",");
}

function formatAlignedCsv(entries: PartitionEntry[]): string {
  const rows = entries.map(entryToFields);
  const widths = columnWidths(rows);
  const headerLine = `# ${formatAlignedRow(
    {
      name: "Name",
      type: "Type",
      subtype: "SubType",
      offset: "Offset",
      size: "Size",
      flags: "Flags",
    },
    widths
  )}`;
  const dataLines = rows.map((row) => formatAlignedRow(row, widths));
  return ["# ESP-IDF Partition Table", headerLine, ...dataLines, ""].join(
    "\n"
  );
}

function sumSizesToMB(entries: PartitionEntry[]): string {
  const totalBytes = entries.reduce((sum, e) => sum + e.size, 0);
  return `${(totalBytes / (1024 * 1024)).toFixed(3)}M`;
}

export function buildPartitionTable(
  csvInput: string,
  offsetPartTable = DEFAULT_OFFSET_PART_TABLE
): PartitionTableResult {
  const entries = parseCsvLines(csvInput);
  calculateOffsets(entries, offsetPartTable);

  const rows: PartitionRow[] = entries.map((e) => ({
    key: e.name,
    name: e.name,
    type: lookupName(e.type, TYPES),
    subtype: lookupName(e.subtype, SUBTYPES[e.type] ?? {}),
    offset: formatAddress(e.offset!, false),
    size: formatAddress(e.size, true),
    flags: e.flags,
  }));

  return {
    rows,
    csv: formatAlignedCsv(entries),
    totalSizeMb: sumSizesToMB(entries),
  };
}
