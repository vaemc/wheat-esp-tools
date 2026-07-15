import { ref } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { openFileInExplorer, getFileInfo } from "@/utils/common";
import { nowMs } from "@/utils/datetime";
import { runEsptoolEraseRegion } from "@/utils/esptoolErase";
import { runEsptoolReadFlash } from "@/utils/esptoolRead";
import { runEsptoolWriteFlash } from "@/utils/esptoolWrite";
import {
  formatHexDisplay,
  formatHexForEsptool,
  type FlashPartition,
} from "@/utils/partitionBin";
import { joinTempWorkDir } from "@/utils/tempWorkDir";
import { usePortStore } from "@/stores/port";

function requirePort(): string {
  const port = usePortStore().selectedPort;
  if (!port) {
    throw new Error("NO_PORT");
  }
  return port;
}

function safeFileStem(name: string): string {
  const stem = name.trim().replace(/[^\w.-]+/g, "_") || "part";
  return stem.slice(0, 48);
}

/** 设备分区：按条读取 / 擦除 / 写入 */
export function usePartitionOps() {
  const busy = ref(false);
  const busyKey = ref("");

  function partitionKey(p: FlashPartition): string {
    return `${p.name}@${p.offset}`;
  }

  function formatPartitionLabel(p: FlashPartition): string {
    return `${p.name} @ ${formatHexDisplay(p.offset)}, ${formatHexDisplay(p.size)}`;
  }

  async function readPartition(
    portBaud: string,
    partition: FlashPartition
  ): Promise<string> {
    if (busy.value) {
      throw new Error("BUSY");
    }
    const port = requirePort();
    const key = partitionKey(partition);
    busy.value = true;
    busyKey.value = key;
    try {
      const path = await joinTempWorkDir(
        "partition",
        `${safeFileStem(partition.name)}-${nowMs()}.bin`
      );
      await runEsptoolReadFlash(
        port,
        portBaud,
        formatHexForEsptool(partition.offset),
        formatHexForEsptool(partition.size),
        path
      );
      await openFileInExplorer(path);
      return path;
    } finally {
      busy.value = false;
      busyKey.value = "";
    }
  }

  async function erasePartition(
    portBaud: string,
    partition: FlashPartition
  ): Promise<void> {
    if (busy.value) {
      throw new Error("BUSY");
    }
    const port = requirePort();
    const key = partitionKey(partition);
    busy.value = true;
    busyKey.value = key;
    try {
      await runEsptoolEraseRegion(
        port,
        portBaud,
        formatHexForEsptool(partition.offset),
        formatHexForEsptool(partition.size)
      );
    } finally {
      busy.value = false;
      busyKey.value = "";
    }
  }

  async function pickBinaryFile(): Promise<string | null> {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Binary", extensions: ["bin"] }],
    });
    if (!selected || Array.isArray(selected)) {
      return null;
    }
    return selected;
  }

  async function writePartition(
    portBaud: string,
    partition: FlashPartition,
    inputPath: string
  ): Promise<void> {
    if (busy.value) {
      throw new Error("BUSY");
    }
    const port = requirePort();
    const info = await getFileInfo(inputPath);
    if (info.len > partition.size) {
      throw new Error("FILE_TOO_LARGE");
    }
    const key = partitionKey(partition);
    busy.value = true;
    busyKey.value = key;
    try {
      await runEsptoolWriteFlash(
        port,
        portBaud,
        [{ offset: formatHexForEsptool(partition.offset), path: inputPath }],
        { after: "hard-reset" }
      );
    } finally {
      busy.value = false;
      busyKey.value = "";
    }
  }

  return {
    busy,
    busyKey,
    partitionKey,
    formatPartitionLabel,
    readPartition,
    erasePartition,
    writePartition,
    pickBinaryFile,
  };
}
