import { computed } from "vue";
import { useI18n } from "vue-i18n";

export function usePartitionColumns() {
  const { t } = useI18n();

  const columns = computed(() => [
    { title: t("partition.colName"), dataIndex: "name", key: "name", width: 88 },
    { title: t("partition.colType"), dataIndex: "type", key: "type", width: 56 },
    {
      title: t("partition.colSubType"),
      dataIndex: "subtype",
      key: "subtype",
      width: 72,
    },
    {
      title: t("partition.colOffset"),
      dataIndex: "offset",
      key: "offset",
      width: 80,
    },
    { title: t("partition.colSize"), dataIndex: "size", key: "size", width: 64 },
    { title: t("partition.colFlags"), dataIndex: "flags", key: "flags" },
  ]);

  return { columns };
}
