import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { PartitionRow } from "@/utils/partitionTable";

export interface PartitionDetailColumn {
  title: string;
  dataIndex: keyof PartitionRow;
  key: string;
  width?: number;
}

export function usePartitionColumns() {
  const { t } = useI18n();

  const columns = computed<PartitionDetailColumn[]>(() => [
    { title: t("partition.colName"), dataIndex: "name", key: "name", width: 120 },
    { title: t("partition.colType"), dataIndex: "type", key: "type", width: 88 },
    {
      title: t("partition.colSubType"),
      dataIndex: "subtype",
      key: "subtype",
      width: 100,
    },
    {
      title: t("partition.colOffset"),
      dataIndex: "offset",
      key: "offset",
      width: 110,
    },
    { title: t("partition.colSize"), dataIndex: "size", key: "size", width: 100 },
    { title: t("partition.colFlags"), dataIndex: "flags", key: "flags", width: 80 },
  ]);

  return { columns };
}
