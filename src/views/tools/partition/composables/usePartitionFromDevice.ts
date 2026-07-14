import { ref } from "vue";
import { readBinaryFile } from "@tauri-apps/api/fs";
import { join } from "@tauri-apps/api/path";
import moment from "moment";
import { runEsptoolReadFlash } from "@/utils/esptoolRead";
import {
  formatHexForEsptool,
  parsePartitionTableBinary,
  type FlashPartition,
} from "@/utils/partitionBin";
import { buildPartitionTableFromFlash } from "@/utils/partitionDeviceTable";
import { getTempWorkDir } from "@/utils/tempWorkDir";
import { usePortStore } from "@/stores/port";
import { usePartitionTableStore } from "@/stores/partitionTable";
import {
  PARTITION_TABLE_SIZE,
  resolvePartitionTableOffset,
  type PartitionTableResult,
} from "@/utils/partitionTable";

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
      const dir = await getTempWorkDir("partitions");
      const ptPath = await join(dir, `pt-read-${moment().valueOf()}.bin`);

      await runEsptoolReadFlash(
        port,
        baudRate,
        formatHexForEsptool(tableOffset),
        formatHexForEsptool(PARTITION_TABLE_SIZE),
        ptPath
      );

      const buffer = await readBinaryFile(ptPath);
      const parsed = parsePartitionTableBinary(new Uint8Array(buffer));
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
