import {
  formatPartitionAddress,
  partitionSubtypeLabel,
  partitionTypeLabel,
  SUBTYPES,
  TYPES,
} from "@/utils/partitionTableFormat";
import { parseSizeParam } from "@/utils/partitionBin";

/** ESP-IDF 分区表 CSV 解析与偏移量计算（对齐 gen_esp32part.py 核心逻辑） */

const APP_TYPE = 0x00;
const DATA_TYPE = 0x01;
const BOOTLOADER_TYPE = 0x02;
const PARTITION_TABLE_TYPE = 0x03;

export const PARTITION_TABLE_SIZE = 0x1000;
export const DEFAULT_OFFSET_PART_TABLE = 0x8000;
/** UI / 配置默认字符串，与 DEFAULT_OFFSET_PART_TABLE 对应 */
export const DEFAULT_OFFSET_PART_TABLE_HEX = "0x8000";

/** 解析分区表偏移；空串回落到默认 0x8000 */
export function resolvePartitionTableOffset(text: string): number {
  const n = parseSizeParam((text || "").trim() || DEFAULT_OFFSET_PART_TABLE_HEX);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("BAD_TABLE_OFFSET");
  }
  return n >>> 0;
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

export interface CsvLineFields {
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
    type: partitionTypeLabel(entry.type),
    subtype: partitionSubtypeLabel(entry.type, entry.subtype),
    offset: formatPartitionAddress(entry.offset!, false),
    size: formatPartitionAddress(entry.size, true),
    flags: entry.flags,
  };
}

function columnWidths(rows: CsvLineFields[]): Record<CsvColumn, number> {
  const headers: CsvLineFields = {
    name: "# Name",
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

/**
 * 所有列统一左对齐：列宽取「列头 / 各行该列」最大值，
 * 格式为 `值,` 后补空格，保证每一列起点与列头文字对齐。
 */
function formatAlignedRow(
  fields: CsvLineFields,
  widths: Record<CsvColumn, number>
): string {
  const line = CSV_COLUMNS.map((col, index) => {
    const value = fields[col];
    const width = widths[col];
    const isLast = index === CSV_COLUMNS.length - 1;

    if (isLast) {
      return value;
    }

    return (value + ",").padEnd(width + 2);
  }).join("");

  return line.replace(/\s+$/, "");
}

/** 生成列宽对齐的分区 CSV，粘贴到编辑器中各列与列头对齐 */
export function formatAlignedCsvLines(rows: CsvLineFields[]): string {
  const widths = columnWidths(rows);
  // 首列用 "# Name"，保证与数据行同一起点对齐（不再额外拼 "# "）
  const headerLine = formatAlignedRow(
    {
      name: "# Name",
      type: "Type",
      subtype: "SubType",
      offset: "Offset",
      size: "Size",
      flags: "Flags",
    },
    widths
  );
  const dataLines = rows.map((row) => formatAlignedRow(row, widths));
  return ["# ESP-IDF Partition Table", headerLine, ...dataLines, ""].join(
    "\n"
  );
}

function formatAlignedCsv(entries: PartitionEntry[]): string {
  return formatAlignedCsvLines(entries.map(entryToFields));
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
    type: partitionTypeLabel(e.type),
    subtype: partitionSubtypeLabel(e.type, e.subtype),
    offset: formatPartitionAddress(e.offset!, false),
    size: formatPartitionAddress(e.size, true),
    flags: e.flags,
  }));

  return {
    rows,
    csv: formatAlignedCsv(entries),
    totalSizeMb: sumSizesToMB(entries),
  };
}
