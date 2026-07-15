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

      // 按偏移排序，保证表格行序与图、读写操作 index 一致
      const sorted = [...parsed].sort((a, b) => a.offset - b.offset);
      partitions.value = sorted;
      result.value = buildPartitionTableFromFlash(sorted);
    } finally {
      loading.value = false;
    }
  }

  return { loading, partitions, result, readFromDevice };
}
