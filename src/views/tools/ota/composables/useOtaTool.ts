import { computed, ref, shallowRef } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import moment from "moment";
import { openFileInExplorer } from "@/utils/common";
import { runEsptoolEraseRegion } from "@/utils/esptoolErase";
import { runEsptoolReadFlash } from "@/utils/esptoolRead";
import { runEsptoolWriteFlash } from "@/utils/esptoolWrite";
import {
  findOtaAppPartitions,
  findOtadataPartition,
  otaSlotOf,
  parseOtadata,
  buildSwitchedOtadata,
  type OtadataInfo,
} from "@/utils/otadata";
import {
  formatHexDisplay,
  formatHexForEsptool,
  type FlashPartition,
} from "@/utils/partitionBin";
import { readPartitionTableFromDevice } from "@/utils/partitionDeviceRead";
import { resolvePartitionTableOffset } from "@/utils/partitionTable";
import { joinTempWorkDir } from "@/utils/tempWorkDir";
import { usePortStore } from "@/stores/port";
import { usePartitionTableStore } from "@/stores/partitionTable";
import { storeToRefs } from "pinia";

function requirePort(): string {
  const port = usePortStore().selectedPort;
  if (!port) {
    throw new Error("NO_PORT");
  }
  return port;
}

function partitionKey(p: FlashPartition): string {
  return `${p.name}@${p.offset}`;
}

export function useOtaTool() {
  const loading = ref(false);
  const baudRate = ref("460800");
  const { tableOffset } = storeToRefs(usePartitionTableStore());
  const otadataPart = ref<FlashPartition | null>(null);
  const otaApps = ref<FlashPartition[]>([]);
  /** TypedArray 必须用 shallowRef，否则 Vue 深代理会卡死/白屏 */
  const otadataRaw = shallowRef<Uint8Array | null>(null);
  const otadataInfo = ref<OtadataInfo | null>(null);
  const selectedKey = ref("");

  const selectedPartition = computed(() => {
    const key = selectedKey.value;
    if (!key) {
      return null;
    }
    return otaApps.value.find((p) => partitionKey(p) === key) ?? null;
  });

  async function tempPath(name: string): Promise<string> {
    return joinTempWorkDir("ota", name);
  }

  async function readFlashBytes(
    port: string,
    offset: number,
    size: number,
    fileName: string
  ): Promise<Uint8Array> {
    const path = await tempPath(fileName);
    await runEsptoolReadFlash(
      port,
      baudRate.value,
      formatHexForEsptool(offset),
      formatHexForEsptool(size),
      path
    );
    return new Uint8Array(await readFile(path));
  }

  async function refreshOtadata(
    port: string,
    otadata: FlashPartition,
    apps: FlashPartition[]
  ): Promise<void> {
    const raw = await readFlashBytes(
      port,
      otadata.offset,
      otadata.size,
      `otadata-${moment().valueOf()}.bin`
    );
    otadataRaw.value = raw;
    otadataInfo.value = parseOtadata(raw, apps.length);
  }

  async function loadFromDevice(): Promise<void> {
    const port = requirePort();
    loading.value = true;
    try {
      const parsed = await readPartitionTableFromDevice(
        port,
        baudRate.value,
        resolvePartitionTableOffset(tableOffset.value)
      );
      if (parsed.length === 0) {
        throw new Error("EMPTY_PARTITION");
      }

      const otadata = findOtadataPartition(parsed);
      if (!otadata) {
        otadataPart.value = null;
        otaApps.value = [];
        otadataRaw.value = null;
        otadataInfo.value = null;
        throw new Error("NO_OTADATA");
      }

      const apps = findOtaAppPartitions(parsed);
      if (apps.length === 0) {
        otadataPart.value = otadata;
        otaApps.value = [];
        throw new Error("NO_OTA_APP");
      }

      otadataPart.value = otadata;
      otaApps.value = apps;
      await refreshOtadata(port, otadata, apps);

      if (
        !selectedKey.value ||
        !apps.some((p) => partitionKey(p) === selectedKey.value)
      ) {
        const active = otadataInfo.value?.activeSlot;
        const prefer =
          active != null
            ? apps.find((p) => otaSlotOf(p) === active)
            : apps[0];
        selectedKey.value = partitionKey(prefer ?? apps[0]);
      }
    } finally {
      loading.value = false;
    }
  }

  async function eraseOtadata(): Promise<void> {
    const port = requirePort();
    const otadata = otadataPart.value;
    if (!otadata) {
      throw new Error("NO_OTADATA");
    }
    loading.value = true;
    try {
      await runEsptoolEraseRegion(
        port,
        baudRate.value,
        formatHexForEsptool(otadata.offset),
        formatHexForEsptool(otadata.size)
      );
      await refreshOtadata(port, otadata, otaApps.value);
    } finally {
      loading.value = false;
    }
  }

  async function switchToSelected(): Promise<void> {
    const port = requirePort();
    const otadata = otadataPart.value;
    const target = selectedPartition.value;
    const raw = otadataRaw.value;
    if (!otadata) {
      throw new Error("NO_OTADATA");
    }
    if (!target) {
      throw new Error("NO_TARGET");
    }
    if (!raw) {
      throw new Error("NO_OTADATA_RAW");
    }

    loading.value = true;
    try {
      const next = buildSwitchedOtadata(raw, target, otaApps.value);
      const path = await tempPath(`otadata-switch-${moment().valueOf()}.bin`);
      await writeFile(path, next);
      await runEsptoolWriteFlash(
        port,
        baudRate.value,
        [{ offset: formatHexForEsptool(otadata.offset), path }],
        { after: "hard-reset" }
      );
      await refreshOtadata(port, otadata, otaApps.value);
    } finally {
      loading.value = false;
    }
  }

  async function readOtaPartition(): Promise<string> {
    const port = requirePort();
    const target = selectedPartition.value;
    if (!target) {
      throw new Error("NO_TARGET");
    }
    loading.value = true;
    try {
      const path = await tempPath(
        `ota_${otaSlotOf(target)}-${moment().valueOf()}.bin`
      );
      await runEsptoolReadFlash(
        port,
        baudRate.value,
        formatHexForEsptool(target.offset),
        formatHexForEsptool(target.size),
        path
      );
      await openFileInExplorer(path);
      return path;
    } finally {
      loading.value = false;
    }
  }

  async function writeOtaPartition(inputPath: string): Promise<void> {
    const port = requirePort();
    const target = selectedPartition.value;
    if (!target) {
      throw new Error("NO_TARGET");
    }
    loading.value = true;
    try {
      await runEsptoolWriteFlash(
        port,
        baudRate.value,
        [{ offset: formatHexForEsptool(target.offset), path: inputPath }],
        { after: "hard-reset" }
      );
    } finally {
      loading.value = false;
    }
  }

  async function pickFirmwareFile(): Promise<string | null> {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Binary", extensions: ["bin"] }],
    });
    if (!selected || Array.isArray(selected)) {
      return null;
    }
    return selected;
  }

  async function eraseOtaPartition(): Promise<void> {
    const port = requirePort();
    const target = selectedPartition.value;
    if (!target) {
      throw new Error("NO_TARGET");
    }
    loading.value = true;
    try {
      await runEsptoolEraseRegion(
        port,
        baudRate.value,
        formatHexForEsptool(target.offset),
        formatHexForEsptool(target.size)
      );
    } finally {
      loading.value = false;
    }
  }

  function formatPartitionLabel(p: FlashPartition): string {
    return `ota_${otaSlotOf(p)} (${p.name}) @ ${formatHexDisplay(p.offset)}, ${formatHexDisplay(p.size)}`;
  }

  return {
    loading,
    baudRate,
    tableOffset,
    otadataPart,
    otaApps,
    otadataInfo,
    selectedKey,
    selectedPartition,
    partitionKey,
    formatPartitionLabel,
    loadFromDevice,
    eraseOtadata,
    switchToSelected,
    readOtaPartition,
    writeOtaPartition,
    pickFirmwareFile,
    eraseOtaPartition,
  };
}
