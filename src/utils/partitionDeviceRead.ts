import { readFile } from "@tauri-apps/plugin-fs";
import { runEsptoolReadFlash } from "@/utils/esptoolRead";
import {
  formatHexForEsptool,
  parsePartitionTableBinary,
  type FlashPartition,
} from "@/utils/partitionBin";
import { PARTITION_TABLE_SIZE } from "@/utils/partitionTable";
import { joinTempWorkDir } from "@/utils/tempWorkDir";

/** 从设备 Flash 读取并解析分区表 */
export async function readPartitionTableFromDevice(
  port: string,
  baudRate: string,
  tableOffset: number
): Promise<FlashPartition[]> {
  const ptPath = await joinTempWorkDir(
    "partitions",
    `pt-read-${Date.now()}.bin`
  );
  await runEsptoolReadFlash(
    port,
    baudRate,
    formatHexForEsptool(tableOffset),
    formatHexForEsptool(PARTITION_TABLE_SIZE),
    ptPath
  );
  const buffer = await readFile(ptPath);
  return parsePartitionTableBinary(new Uint8Array(buffer));
}
