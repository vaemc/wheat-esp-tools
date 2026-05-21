import { ref } from "vue";
import { open } from "@tauri-apps/api/dialog";
import { readBinaryFile } from "@tauri-apps/api/fs";
import moment from "moment";
import cli, { execute } from "@/utils/cli";
import { getCurrentDir } from "@/utils/common";
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

async function runEsptoolReadFlash(
  port: string,
  baud: string,
  offset: string,
  size: string,
  savePath: string
): Promise<void> {
  execute("esptool", [
    "-p",
    port,
    "-b",
    baud,
    "read-flash",
    offset,
    size,
    savePath,
  ]);

  await new Promise<void>((resolve, reject) => {
    const onClose = () => {
      cli.all.clear();
      resolve();
    };
    const onError = () => {
      cli.all.clear();
      reject(new Error("READ_FAILED"));
    };
    cli.on("close", onClose);
    cli.on("error", onError);
  });
}

export function useNvsReader() {
  const loading = ref(false);
  const detecting = ref(false);
  const rows = ref<NvsKeyValue[]>([]);
  const keyword = ref("");
  const offset = ref("0x9000");
  const size = ref("0x6000");
  const baudRate = ref("460800");
  const detectedInfo = ref("");

  async function detectNvsPartitionFromDevice(): Promise<void> {
    const port = localStorage.getItem("port");
    if (!port) {
      throw new Error("NO_PORT");
    }

    detecting.value = true;
    try {
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
    } finally {
      detecting.value = false;
    }
  }

  async function parseFile(path: string) {
    loading.value = true;
    try {
      rows.value = await parseNvsPartition(path);
    } finally {
      loading.value = false;
    }
  }

  async function readFromDevice() {
    const port = localStorage.getItem("port");
    if (!port) {
      throw new Error("NO_PORT");
    }

    await detectNvsPartitionFromDevice();

    const dir = await getCurrentDir();
    const savePath = `${dir}\\nvs\\nvs-${moment().valueOf()}.bin`;

    loading.value = true;
    rows.value = [];

    try {
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
    if (typeof selected === "string") {
      await parseFile(selected);
    }
  }

  return {
    loading,
    detecting,
    rows,
    keyword,
    offset,
    size,
    baudRate,
    detectedInfo,
    detectNvsPartitionFromDevice,
    readFromDevice,
    openLocalFile,
    parseFile,
  };
}
