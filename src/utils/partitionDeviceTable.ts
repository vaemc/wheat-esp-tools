import type { FlashPartition } from "@/utils/partitionBin";
import {
  formatAlignedCsvLines,
  PartitionTableError,
  type PartitionRow,
  type PartitionTableResult,
} from "@/utils/partitionTable";
import {
  formatPartitionAddress,
  partitionSubtypeLabel,
  partitionTypeLabel,
} from "@/utils/partitionTableFormat";

/** 将设备 Flash 读出的分区列表转为表格行与 CSV（不做偏移重算） */
export function buildPartitionTableFromFlash(
  partitions: FlashPartition[]
): PartitionTableResult {
  if (partitions.length === 0) {
    throw new PartitionTableError("分区表为空");
  }

  // 按偏移排序，与布局图 / 容量图顺序一致
  const sorted = [...partitions].sort((a, b) => a.offset - b.offset);

  const fields = sorted.map((p) => ({
    name: p.name,
    type: partitionTypeLabel(p.type),
    subtype: partitionSubtypeLabel(p.type, p.subtype),
    offset: formatPartitionAddress(p.offset, false),
    size: formatPartitionAddress(p.size, true),
    flags: "",
  }));

  const rows: PartitionRow[] = fields.map((f, i) => ({
    key: `${sorted[i].name}@${sorted[i].offset}`,
    ...f,
  }));

  // 与图表「分区合计」、对齐模式一致：各分区 size 之和
  const used = sorted.reduce((sum, p) => sum + p.size, 0);

  return {
    rows,
    csv: formatAlignedCsvLines(fields),
    totalSizeMb: `${(used / (1024 * 1024)).toFixed(3)}M`,
  };
}
