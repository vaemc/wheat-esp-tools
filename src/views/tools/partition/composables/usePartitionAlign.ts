import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { message } from "ant-design-vue";
import {
  buildPartitionTable,
  PartitionTableError,
  resolvePartitionTableOffset,
} from "@/utils/partitionTable";
import { usePartitionTableStore } from "@/stores/partitionTable";

const DEFAULT_CSV = `# Name, Type, SubType, Offset, Size, Flags
nvs, data, nvs, , 0x6000,
otadata, data, ota, , 0x2000,
phy_init, data, phy, , 0x1000,
factory, app, factory, , 1M,
`;

/** CSV 分区表偏移自动对齐计算 */
export function usePartitionAlign() {
  const { t } = useI18n();
  const inputCsv = ref(DEFAULT_CSV);
  const error = ref<string | null>(null);
  const { tableOffset } = storeToRefs(usePartitionTableStore());

  const result = computed(() => {
    const text = inputCsv.value?.trim();
    if (!text) {
      error.value = null;
      return null;
    }
    try {
      const ptOffset = resolvePartitionTableOffset(tableOffset.value);
      const table = buildPartitionTable(inputCsv.value, ptOffset);
      error.value = null;
      return table;
    } catch (e) {
      if (e instanceof Error && e.message === "BAD_TABLE_OFFSET") {
        error.value = t("partition.badTableOffset");
        return null;
      }
      error.value =
        e instanceof PartitionTableError
          ? e.message
          : t("partition.parseError");
      return null;
    }
  });

  async function copyOutput() {
    if (!result.value?.csv) {
      return;
    }
    try {
      await navigator.clipboard.writeText(result.value.csv);
      message.success(t("partition.copied"));
    } catch {
      message.error(t("partition.copyFailed"));
    }
  }

  return {
    inputCsv,
    tableOffset,
    error,
    result,
    copyOutput,
  };
}
