import { ref } from "vue";
import { buildPartitionTableFromFlash } from "@/utils/partitionDeviceTable";
import { readPartitionTableFromDevice } from "@/utils/partitionDeviceRead";
import { resolvePartitionTableOffset, type PartitionTableResult } from "@/utils/partitionTable";
import type { FlashPartition } from "@/utils/partitionBin";
import { usePortStore } from "@/stores/port";
import { usePartitionTableStore } from "@/stores/partitionTable";

/** 从设备 Flash 读取分区表二进制并展示 */
export function usePartitionFromDevice() {
  const loading = ref(false);
  const partitions = ref<FlashPartition[]>([]);
  const result = ref<PartitionTableResult | null>(null);
  const partTableStore = usePartitionTableStore();

  async function readFromDevice(baudRate: string): Promise<void> {
    const port = usePortStore().selectedPort;
    if (!port) {
      throw new Error("NO_PORT");
    }

    const tableOffset = resolvePartitionTableOffset(partTableStore.tableOffset);

    loading.value = true;
    try {
      const parsed = await readPartitionTableFromDevice(
        port,
        baudRate,
        tableOffset
      );
      if (parsed.length === 0) {
        throw new Error("EMPTY_PARTITION");
      }

      partitions.value = parsed;
      result.value = buildPartitionTableFromFlash(parsed);
    } finally {
      loading.value = false;
    }
  }

  return { loading, partitions, result, readFromDevice };
}
