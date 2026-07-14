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

  const fields = partitions.map((p) => ({
    name: p.name,
    type: partitionTypeLabel(p.type),
    subtype: partitionSubtypeLabel(p.type, p.subtype),
    offset: formatPartitionAddress(p.offset, false),
    size: formatPartitionAddress(p.size, true),
    flags: "",
  }));

  const rows: PartitionRow[] = fields.map((f) => ({
    key: f.name,
    ...f,
  }));

  const totalEnd = Math.max(...partitions.map((p) => p.offset + p.size));

  return {
    rows,
    csv: formatAlignedCsvLines(fields),
    totalSizeMb: `${(totalEnd / (1024 * 1024)).toFixed(3)}M`,
  };
}
