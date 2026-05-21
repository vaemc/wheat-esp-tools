import { ref } from "vue";
import { readBinaryFile } from "@tauri-apps/api/fs";
import moment from "moment";
import { getCurrentDir } from "@/utils/common";
import { runEsptoolReadFlash } from "@/utils/esptoolRead";
import {
  formatHexForEsptool,
  parsePartitionTableBinary,
  type FlashPartition,
} from "@/utils/partitionBin";
import { buildPartitionTableFromFlash } from "@/utils/partitionDeviceTable";
import {
  DEFAULT_OFFSET_PART_TABLE,
  PARTITION_TABLE_SIZE,
  type PartitionTableResult,
} from "@/utils/partitionTable";

/** 从设备 Flash 读取分区表二进制并展示 */
export function usePartitionFromDevice() {
  const loading = ref(false);
  const partitions = ref<FlashPartition[]>([]);
  const result = ref<PartitionTableResult | null>(null);

  async function readFromDevice(baudRate: string): Promise<void> {
    const port = localStorage.getItem("port");
    if (!port) {
      throw new Error("NO_PORT");
    }

    loading.value = true;
    try {
      const dir = await getCurrentDir();
      const ptPath = `${dir}\\partitions\\pt-read-${moment().valueOf()}.bin`;

      await runEsptoolReadFlash(
        port,
        baudRate,
        formatHexForEsptool(DEFAULT_OFFSET_PART_TABLE),
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
