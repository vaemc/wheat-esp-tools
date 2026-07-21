import { computed, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { basename, dirname } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { message } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import {
  getFileInfo,
  openDirectoryInExplorer,
  openFileInExplorer,
} from "@/utils/common";

export interface MmapAssetEntry {
  rel: string;
  size: number;
}

export interface MmapProbeResult {
  dir: string;
  files: MmapAssetEntry[];
  totalBytes: number;
  errors: string[];
  hasIndexJson: boolean;
}

export interface MmapPackResult {
  outputPath: string;
  fileCount: number;
  size: number;
  checksum: number;
  indexJsonSource: string;
}

export interface MmapIndexEntry {
  name: string;
  size: number;
  offset: number;
  width: number;
  height: number;
}

export interface MmapIndexPreview {
  source: string;
  path: string;
  fileCount: number;
  checksum?: number | null;
  payloadLen?: number | null;
  binSize?: number | null;
  headerLen: number;
  tableEntryLen: number;
  files: MmapIndexEntry[];
}

export interface IndexJsonPreview {
  source: string;
  path: string;
  content: string;
}

/** 文件列表区当前展示来源 */
export type ListViewSource = "none" | "dir" | "bin";

export function useMmapPack(emit: {
  (e: "summary", payload: {
    hasDir: boolean;
    done: boolean;
    dirName?: string;
    fileCount?: number;
  }): void;
}) {
  const { t } = useI18n();
  const dirPath = ref<string | null>(null);
  const dirName = ref("");
  const probing = ref(false);
  const packing = ref(false);
  const previewing = ref(false);
  const previewingManifest = ref(false);
  const probe = ref<MmapProbeResult | null>(null);
  const lastPack = ref<MmapPackResult | null>(null);
  const indexPreview = ref<MmapIndexPreview | null>(null);
  const indexModalOpen = ref(false);
  const manifestPreview = ref<IndexJsonPreview | null>(null);
  const manifestModalOpen = ref(false);
  const autoGenerateIndex = ref(true);
  const dragOver = ref(false);

  const listSource = ref<ListViewSource>("none");
  const openedBinPath = ref<string | null>(null);
  const openedBinName = ref("");
  const binFiles = ref<MmapAssetEntry[]>([]);
  const binMapPreview = ref<MmapIndexPreview | null>(null);

  const hasDir = computed(() => !!dirPath.value);
  const hasBinView = computed(() => listSource.value === "bin");
  const listFiles = computed<MmapAssetEntry[]>(() => {
    if (listSource.value === "bin") {
      return binFiles.value;
    }
    if (listSource.value === "dir") {
      return probe.value?.files ?? [];
    }
    return [];
  });
  const listTotalBytes = computed(() =>
    listFiles.value.reduce((acc, f) => acc + f.size, 0)
  );
  const fileCount = computed(() => listFiles.value.length);
  const hasExistingIndex = computed(() => !!probe.value?.hasIndexJson);
  const canPreview = computed(() => listSource.value !== "none");
  const canPack = computed(
    () =>
      !!dirPath.value &&
      (probe.value?.files.length ?? 0) > 0 &&
      !(probe.value?.errors.length ?? 0) &&
      !probing.value &&
      !packing.value
  );

  const indexJsonText = computed(() =>
    indexPreview.value ? JSON.stringify(indexPreview.value, null, 2) : ""
  );
  const manifestJsonText = computed(() => manifestPreview.value?.content ?? "");
  const manifestHintKey = computed(() => {
    switch (manifestPreview.value?.source) {
      case "existing":
        return "file.manifestModalHintExisting";
      case "from_bin":
        return "file.manifestModalHintFromBin";
      default:
        return "file.manifestModalHintGenerated";
    }
  });
  const packIndexSourceKey = computed(() => {
    switch (lastPack.value?.indexJsonSource) {
      case "existing":
        return "file.indexSourceExisting";
      case "generated":
        return "file.indexSourceGenerated";
      case "none":
        return "file.indexSourceNone";
      default:
        return "";
    }
  });

  function emitSummary() {
    emit("summary", {
      hasDir: hasDir.value,
      done: !!lastPack.value,
      dirName: dirName.value || undefined,
      fileCount:
        listSource.value === "dir"
          ? (probe.value?.files.length ?? 0)
          : fileCount.value,
    });
  }

  watch([dirPath, probe, listSource, lastPack], emitSummary, { deep: true });

  function clearBinView() {
    openedBinPath.value = null;
    openedBinName.value = "";
    binFiles.value = [];
    binMapPreview.value = null;
  }

  function formatBytes(n: number) {
    if (n < 1024) {
      return `${n} B`;
    }
    if (n < 1024 * 1024) {
      return `${(n / 1024).toFixed(1)} KB`;
    }
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  async function setDir(path: string) {
    probing.value = true;
    lastPack.value = null;
    indexPreview.value = null;
    manifestPreview.value = null;
    clearBinView();
    try {
      const info = await getFileInfo(path);
      if (!info.isDir) {
        message.warning(t("file.needDirectory"));
        return;
      }
      const result = (await invoke("probe_mmap_assets_dir", {
        dir: path,
      })) as MmapProbeResult;
      dirPath.value = path;
      dirName.value = (await basename(path)) || path;
      probe.value = result;
      listSource.value = "dir";
      autoGenerateIndex.value = !result.hasIndexJson;
      if (result.errors?.length) {
        message.warning(result.errors[0]);
      }
      if (!result.files.length) {
        message.warning(t("file.emptyDir"));
      }
    } catch (e) {
      message.error(String(e));
    } finally {
      probing.value = false;
    }
  }

  async function pickDir() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("file.pickDirTitle"),
    });
    if (typeof selected === "string" && selected) {
      await setDir(selected);
    }
  }

  async function onDropPaths(paths: string[]) {
    dragOver.value = false;
    const first = paths.find(Boolean);
    if (!first) {
      return;
    }
    await setDir(first);
  }

  function clearDir() {
    dirPath.value = null;
    dirName.value = "";
    probe.value = null;
    lastPack.value = null;
    indexPreview.value = null;
    indexModalOpen.value = false;
    manifestPreview.value = null;
    manifestModalOpen.value = false;
    autoGenerateIndex.value = true;
    clearBinView();
    listSource.value = "none";
  }

  async function previewMapTable() {
    if (listSource.value === "bin" && openedBinPath.value) {
      if (binMapPreview.value) {
        indexPreview.value = binMapPreview.value;
        indexModalOpen.value = true;
        return;
      }
      previewing.value = true;
      try {
        const preview = (await invoke("preview_mmap_index_from_bin", {
          binPath: openedBinPath.value,
        })) as MmapIndexPreview;
        binMapPreview.value = preview;
        indexPreview.value = preview;
        indexModalOpen.value = true;
      } catch (e) {
        message.error(String(e));
      } finally {
        previewing.value = false;
      }
      return;
    }

    if (!dirPath.value) {
      message.warning(t("file.needDirectory"));
      return;
    }
    previewing.value = true;
    try {
      const preview = (await invoke("preview_mmap_index_from_dir", {
        dir: dirPath.value,
      })) as MmapIndexPreview;
      indexPreview.value = preview;
      indexModalOpen.value = true;
    } catch (e) {
      message.error(String(e));
    } finally {
      previewing.value = false;
    }
  }

  async function pickBinPath() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "BIN", extensions: ["bin"] }],
      title: t("file.openBinTitle"),
    });
    if (typeof selected !== "string" || !selected) {
      return null;
    }
    return selected;
  }

  /** 打开 .bin：在列表区展示包内文件（路径 + 大小） */
  async function openBinPreview(path?: string) {
    const binPath = path ?? (await pickBinPath());
    if (!binPath) {
      return;
    }
    probing.value = true;
    try {
      const preview = (await invoke("preview_mmap_index_from_bin", {
        binPath,
      })) as MmapIndexPreview;
      openedBinPath.value = binPath;
      openedBinName.value = (await basename(binPath)) || binPath;
      binMapPreview.value = preview;
      binFiles.value = preview.files.map((f) => ({
        rel: f.name,
        size: f.size,
      }));
      listSource.value = "bin";
      indexPreview.value = null;
      manifestPreview.value = null;
      if (!binFiles.value.length) {
        message.warning(t("file.emptyBin"));
      }
    } catch (e) {
      message.error(String(e));
    } finally {
      probing.value = false;
    }
  }

  async function previewLastPackBin() {
    const path = lastPack.value?.outputPath;
    if (!path) {
      return;
    }
    await openBinPreview(path);
  }

  /** 预览 index.json（目录解析/生成，或从已打开的 .bin 提取） */
  async function previewManifestJson() {
    previewingManifest.value = true;
    try {
      if (listSource.value === "bin" && openedBinPath.value) {
        const preview = (await invoke("preview_index_json_from_bin", {
          binPath: openedBinPath.value,
        })) as IndexJsonPreview;
        manifestPreview.value = preview;
        manifestModalOpen.value = true;
        return;
      }

      if (!dirPath.value) {
        message.warning(t("file.needDirectoryOrBin"));
        return;
      }
      const preview = (await invoke("preview_or_build_index_json", {
        dir: dirPath.value,
        autoGenerate: autoGenerateIndex.value,
      })) as IndexJsonPreview;
      manifestPreview.value = preview;
      manifestModalOpen.value = true;
    } catch (e) {
      message.error(String(e));
    } finally {
      previewingManifest.value = false;
    }
  }

  async function pack() {
    if (!dirPath.value || !canPack.value) {
      return;
    }
    const out = await save({
      defaultPath: "mmap_assets.bin",
      filters: [{ name: "BIN", extensions: ["bin"] }],
      title: t("file.saveBinTitle"),
    });
    if (!out) {
      return;
    }
    packing.value = true;
    try {
      const result = (await invoke("pack_mmap_assets", {
        dir: dirPath.value,
        outputPath: out,
        autoGenerateIndex: autoGenerateIndex.value,
      })) as MmapPackResult;
      lastPack.value = result;
      message.success(
        t("file.packSuccess", {
          n: result.fileCount,
          size: formatBytes(result.size),
        })
      );
    } catch (e) {
      message.error(String(e));
    } finally {
      packing.value = false;
    }
  }

  async function revealOutput() {
    const path = lastPack.value?.outputPath;
    if (!path) {
      return;
    }
    try {
      await openFileInExplorer(path);
    } catch {
      const dir = await dirname(path);
      await openDirectoryInExplorer(dir);
    }
  }

  return {
    dirPath,
    dirName,
    probing,
    packing,
    previewing,
    previewingManifest,
    probe,
    lastPack,
    indexModalOpen,
    indexJsonText,
    manifestModalOpen,
    manifestJsonText,
    manifestHintKey,
    packIndexSourceKey,
    autoGenerateIndex,
    hasExistingIndex,
    listSource,
    openedBinPath,
    openedBinName,
    listFiles,
    listTotalBytes,
    hasBinView,
    canPreview,
    dragOver,
    hasDir,
    fileCount,
    canPack,
    pickDir,
    onDropPaths,
    clearDir,
    pack,
    revealOutput,
    previewMapTable,
    openBinPreview,
    previewLastPackBin,
    previewManifestJson,
    formatBytes,
  };
}
