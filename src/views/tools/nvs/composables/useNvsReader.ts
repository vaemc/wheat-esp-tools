import { ref } from "vue";
import { open } from "@tauri-apps/api/dialog";
import { readBinaryFile } from "@tauri-apps/api/fs";
import moment from "moment";
import { getCurrentDir } from "@/utils/common";
import { runEsptoolReadFlash } from "@/utils/esptoolRead";
import {
  findNvsPartition,
  formatHexDisplay,
  formatHexForEsptool,
  parsePartitionTableBinary,
} from "@/utils/partitionBin";
import {
  DEFAULT_OFFSET_PART_TABLE,
  PARTITION_TABLE_SIZE,
} from "@/utils/partitionTable";
import { parseNvsPartition, type NvsKeyValue } from "@/utils/nvs";

export function useNvsReader() {
  const loading = ref(false);
  const rows = ref<NvsKeyValue[]>([]);
  const keyword = ref("");
  const offset = ref("0x9000");
  const size = ref("0x6000");
  const baudRate = ref("460800");
  const detectedInfo = ref("");

  /** 从设备读取分区表并填充 NVS 偏移/大小 */
  async function detectNvsPartitionFromDevice(port: string): Promise<void> {
    const dir = await getCurrentDir();
    const ptPath = `${dir}\\partitions\\pt-read-${moment().valueOf()}.bin`;

    await runEsptoolReadFlash(
      port,
      baudRate.value,
      formatHexForEsptool(DEFAULT_OFFSET_PART_TABLE),
      formatHexForEsptool(PARTITION_TABLE_SIZE),
      ptPath
    );

    const buffer = await readBinaryFile(ptPath);
    const partitions = parsePartitionTableBinary(new Uint8Array(buffer));
    const nvs = findNvsPartition(partitions);

    if (!nvs) {
      detectedInfo.value = "";
      throw new Error("NO_NVS");
    }

    offset.value = formatHexForEsptool(nvs.offset);
    size.value = formatHexForEsptool(nvs.size);
    detectedInfo.value = `${nvs.name} @ ${formatHexDisplay(nvs.offset)}, ${formatHexDisplay(nvs.size)}`;
  }

  async function parseFile(path: string) {
    rows.value = await parseNvsPartition(path);
  }

  /** 检测 NVS 分区后读取并解析 */
  async function readFromDevice() {
    const port = localStorage.getItem("port");
    if (!port) {
      throw new Error("NO_PORT");
    }

    loading.value = true;
    rows.value = [];

    try {
      await detectNvsPartitionFromDevice(port);

      const dir = await getCurrentDir();
      const savePath = `${dir}\\nvs\\nvs-${moment().valueOf()}.bin`;

      await runEsptoolReadFlash(
        port,
        baudRate.value,
        offset.value,
        size.value,
        savePath
      );
      await parseFile(savePath);
    } finally {
      loading.value = false;
    }
  }

  async function openLocalFile() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "NVS Binary", extensions: ["bin"] }],
    });
    if (typeof selected !== "string") {
      return;
    }

    loading.value = true;
    try {
      await parseFile(selected);
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    rows,
    keyword,
    offset,
    size,
    baudRate,
    detectedInfo,
    readFromDevice,
    openLocalFile,
  };
}
