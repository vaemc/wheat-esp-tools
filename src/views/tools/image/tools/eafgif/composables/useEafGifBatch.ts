import { computed, onBeforeUnmount, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile, remove, writeFile } from "@tauri-apps/plugin-fs";
import {
  EAF_DEFAULT_SAMPLE_FPS,
  decodeEaf,
  isEafBytes,
  probeEafMeta,
} from "@/utils/image/eaf";
import {
  buildRgbaDump,
  canvasToObjectUrl,
} from "@/utils/image/eaf/rgbaDump";
import { base64ToBytesAsync } from "@/utils/image/shared/base64";
import { joinTempWorkDir } from "@/utils/tempWorkDir";

export type EafGifItemStatus =
  | "loading"
  | "idle"
  | "converting"
  | "done"
  | "error";

export interface EafGifResultLocal {
  bytes: Uint8Array;
  objectUrl: string;
  width: number;
  height: number;
  frameCount: number;
  byteLength: number;
}

export interface EafGifBatchItem {
  id: string;
  fileName: string;
  objectUrl: string;
  path: string;
  naturalWidth: number;
  naturalHeight: number;
  frameCount: number;
  bitDepth: number;
  byteLength: number;
  status: EafGifItemStatus;
  progress?: number;
  progressMessage?: string;
  result?: EafGifResultLocal;
  errorMessage?: string;
}

interface RustGifResult {
  width: number;
  height: number;
  frameCount: number;
  byteLength: number;
  gifBase64: string;
}

interface ProgressEvent {
  jobId: string;
  path: string;
  stage: string;
  current: number;
  total: number;
  percent: number;
  message: string;
}

let nextId = 1;
let jobSeq = 1;
const PROBE_CONCURRENCY = 2;
const OUTPUT_SIZE_MAX = 4096;

function fileNameFromPath(path: string) {
  return path.split(/[/\\]/).pop() || path;
}

function baseNameFrom(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function clampOutputSize(n: number): number {
  return clamp(Math.round(n), 1, OUTPUT_SIZE_MAX);
}

async function mapPool<T, R>(
  list: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(list.length);
  let next = 0;
  async function run() {
    while (next < list.length) {
      const index = next;
      next += 1;
      results[index] = await worker(list[index]!, index);
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, Math.max(1, list.length)) },
      () => run()
    )
  );
  return results;
}

export function useEafGifBatch() {
  const items = ref<EafGifBatchItem[]>([]);
  const loading = ref(false);
  const selectedId = ref<string | null>(null);
  const converting = ref(false);
  const overallProgress = ref(0);
  const overallMessage = ref("");
  let convertToken = 0;

  const fps = ref(EAF_DEFAULT_SAMPLE_FPS);
  const frameStep = ref(0);
  const outputWidth = ref<number | null>(null);
  const outputHeight = ref<number | null>(null);
  const lockAspect = ref(true);
  const colors = ref<8 | 16 | 32 | 64 | 128 | 256>(64);
  const dither = ref(false);
  const frameDiff = ref(true);
  const lossy = ref(40);

  const hasItems = computed(() => items.value.length > 0);
  const selectedItem = computed(
    () => items.value.find((item) => item.id === selectedId.value) ?? null
  );
  const doneCount = computed(
    () => items.value.filter((item) => item.status === "done").length
  );

  let unlistenProgress: UnlistenFn | null = null;
  const activeJobId = ref<string | null>(null);
  const activeConvertItemId = ref<string | null>(null);
  let batchFileIndex = 0;
  let batchFileCount = 1;

  function patchItem(id: string, patch: Partial<EafGifBatchItem>) {
    const index = items.value.findIndex((entry) => entry.id === id);
    if (index < 0) {
      return;
    }
    const prev = items.value[index]!;
    if (
      patch.objectUrl &&
      prev.objectUrl &&
      patch.objectUrl !== prev.objectUrl
    ) {
      URL.revokeObjectURL(prev.objectUrl);
    }
    if (patch.result && prev.result?.objectUrl) {
      URL.revokeObjectURL(prev.result.objectUrl);
    }
    items.value[index] = { ...prev, ...patch };
  }

  function updateOverallFromFile(filePercent: number) {
    const base = batchFileIndex / batchFileCount;
    const portion = filePercent / 100 / batchFileCount;
    overallProgress.value = Math.round(
      Math.min(100, Math.max(0, (base + portion) * 100))
    );
  }

  async function ensureProgressListener() {
    if (unlistenProgress) {
      return;
    }
    unlistenProgress = await listen<ProgressEvent>(
      "gif_compress_progress",
      (event) => {
        const payload = event.payload;
        if (
          activeJobId.value &&
          payload.jobId &&
          payload.jobId !== activeJobId.value
        ) {
          return;
        }
        const itemId = activeConvertItemId.value;
        if (itemId) {
          const mapped = 32 + Math.round((payload.percent / 100) * 68);
          patchItem(itemId, {
            progress: mapped,
            progressMessage: payload.message,
          });
        }
        overallMessage.value = payload.message;
        updateOverallFromFile(32 + (payload.percent / 100) * 68);
      }
    );
  }

  function revokeItem(item: EafGifBatchItem) {
    if (item.objectUrl) {
      URL.revokeObjectURL(item.objectUrl);
    }
    if (item.result?.objectUrl) {
      URL.revokeObjectURL(item.result.objectUrl);
    }
  }

  async function probePath(path: string): Promise<EafGifBatchItem> {
    const bytes = await readFile(path);
    if (!isEafBytes(bytes)) {
      throw new Error("NOT_EAF");
    }
    const meta = probeEafMeta(bytes);
    const decoded = await decodeEaf(bytes);
    const thumbUrl = await canvasToObjectUrl(decoded.frames[0]!);
    return {
      id: `eafgif-${nextId++}`,
      fileName: fileNameFromPath(path),
      objectUrl: thumbUrl,
      path,
      naturalWidth: meta.width,
      naturalHeight: meta.height,
      frameCount: meta.frameCount,
      bitDepth: meta.bitDepth,
      byteLength: bytes.byteLength,
      status: "idle",
      progress: 0,
      progressMessage: "",
    };
  }

  async function addPaths(paths: string[]) {
    const eafPaths = paths.filter((p) => /\.eaf$/i.test(p));
    if (!eafPaths.length) {
      throw new Error("NOT_EAF");
    }
    loading.value = true;
    try {
      const added = await mapPool(eafPaths, PROBE_CONCURRENCY, async (path) => {
        try {
          return await probePath(path);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            id: `eafgif-${nextId++}`,
            fileName: fileNameFromPath(path),
            objectUrl: "",
            path,
            naturalWidth: 0,
            naturalHeight: 0,
            frameCount: 0,
            bitDepth: 0,
            byteLength: 0,
            status: "error" as const,
            errorMessage: msg === "NOT_EAF" ? "NOT_EAF" : msg,
          };
        }
      });
      items.value = [...items.value, ...added];
      if (!selectedId.value) {
        const firstOk = added.find((item) => item.status !== "error");
        selectedId.value = firstOk?.id ?? added[0]?.id ?? null;
      }
    } finally {
      loading.value = false;
    }
  }

  async function pickEafs() {
    const selected = await open({
      multiple: true,
      filters: [{ name: "EAF", extensions: ["eaf"] }],
    });
    if (selected == null) {
      return;
    }
    const paths = Array.isArray(selected) ? selected : [selected];
    await addPaths(paths);
  }

  function removeItem(id: string) {
    const item = items.value.find((entry) => entry.id === id);
    if (item) {
      revokeItem(item);
    }
    items.value = items.value.filter((entry) => entry.id !== id);
    if (selectedId.value === id) {
      selectedId.value = items.value[0]?.id ?? null;
    }
  }

  function stopConvert() {
    convertToken += 1;
    converting.value = false;
    overallMessage.value = "";
    activeJobId.value = null;
    activeConvertItemId.value = null;
    for (const item of items.value) {
      if (item.status === "converting") {
        patchItem(item.id, {
          status: "idle",
          progress: 0,
          progressMessage: "",
        });
      }
    }
  }

  function clearAll() {
    stopConvert();
    for (const item of items.value) {
      revokeItem(item);
    }
    items.value = [];
    selectedId.value = null;
    overallProgress.value = 0;
    overallMessage.value = "";
  }

  function selectItem(id: string) {
    selectedId.value = id;
  }

  function resetOutputSize() {
    outputWidth.value = null;
    outputHeight.value = null;
  }

  function setOutputWidth(width: number | null) {
    if (width == null || !Number.isFinite(width)) {
      outputWidth.value = null;
      return;
    }
    const w = clampOutputSize(width);
    outputWidth.value = w;
    const item = selectedItem.value;
    if (lockAspect.value && item && w > 0 && item.naturalWidth > 0) {
      outputHeight.value = clampOutputSize(
        (w * item.naturalHeight) / item.naturalWidth
      );
    }
  }

  function setOutputHeight(height: number | null) {
    if (height == null || !Number.isFinite(height)) {
      outputHeight.value = null;
      return;
    }
    const h = clampOutputSize(height);
    outputHeight.value = h;
    const item = selectedItem.value;
    if (lockAspect.value && item && h > 0 && item.naturalHeight > 0) {
      outputWidth.value = clampOutputSize(
        (h * item.naturalWidth) / item.naturalHeight
      );
    }
  }

  async function convertOne(
    item: EafGifBatchItem,
    jobId: string,
    token: number
  ): Promise<void> {
    patchItem(item.id, {
      status: "converting",
      progress: 2,
      progressMessage: "解码 EAF…",
      errorMessage: undefined,
    });
    activeConvertItemId.value = item.id;

    const bytes = await readFile(item.path);
    if (token !== convertToken) {
      return;
    }

    const decoded = await decodeEaf(bytes, {
      onProgress: (current, total) => {
        if (token !== convertToken) {
          return;
        }
        const percent = 2 + Math.round((current / Math.max(1, total)) * 28);
        patchItem(item.id, {
          progress: percent,
          progressMessage: `解码帧 ${current}/${total}`,
        });
        updateOverallFromFile(percent);
      },
    });
    if (token !== convertToken) {
      return;
    }

    const delayMs = Math.max(10, Math.round(1000 / Math.max(0.5, fps.value)));
    const dump = buildRgbaDump(decoded.frames, delayMs);
    const dumpPath = await joinTempWorkDir(
      "eafgif",
      `${baseNameFrom(item.fileName)}-${Date.now()}.rgba`
    );
    await writeFile(dumpPath, dump);
    if (token !== convertToken) {
      try {
        await remove(dumpPath);
      } catch {
        // ignore
      }
      return;
    }

    activeJobId.value = jobId;
    patchItem(item.id, {
      progress: 32,
      progressMessage: "编码 GIF…",
    });

    try {
      const result = await invoke<RustGifResult>("encode_rgba_dump_to_gif", {
        path: dumpPath,
        jobId,
        options: {
          frameStep: frameStep.value,
          width: outputWidth.value ?? undefined,
          height: outputHeight.value ?? undefined,
          colors: colors.value,
          dither: dither.value,
          frameDiff: frameDiff.value,
          lossy: lossy.value,
          delayMode: "keep",
          fixedDelayMs: delayMs,
        },
      });
      if (token !== convertToken) {
        return;
      }
      const gifBytes = await base64ToBytesAsync(result.gifBase64);
      const objectUrl = URL.createObjectURL(
        new Blob([new Uint8Array(gifBytes)], { type: "image/gif" })
      );
      patchItem(item.id, {
        status: "done",
        progress: 100,
        progressMessage: "",
        result: {
          bytes: gifBytes,
          objectUrl,
          width: result.width,
          height: result.height,
          frameCount: result.frameCount,
          byteLength: Number(result.byteLength) || gifBytes.length,
        },
      });
    } finally {
      try {
        await remove(dumpPath);
      } catch {
        // ignore
      }
    }
  }

  async function convertAll() {
    const queue = items.value.filter((item) => item.status !== "error");
    if (!queue.length || converting.value) {
      return { success: 0, failed: 0, aborted: false };
    }
    await ensureProgressListener();
    const token = ++convertToken;
    converting.value = true;
    overallProgress.value = 0;
    overallMessage.value = "";
    let success = 0;
    let failed = 0;
    let aborted = false;
    batchFileCount = Math.max(1, queue.length);
    batchFileIndex = 0;
    try {
      for (const item of queue) {
        if (token !== convertToken) {
          aborted = true;
          break;
        }
        if (!items.value.some((entry) => entry.id === item.id)) {
          aborted = true;
          break;
        }
        const jobId = `eafgif-job-${jobSeq++}`;
        overallMessage.value = item.fileName;
        try {
          await convertOne(item, jobId, token);
          if (token !== convertToken) {
            aborted = true;
            break;
          }
          const latest = items.value.find((entry) => entry.id === item.id);
          if (latest?.status === "done") {
            success += 1;
          } else if (latest?.status === "error") {
            failed += 1;
          }
        } catch (error) {
          if (token !== convertToken) {
            aborted = true;
            break;
          }
          console.error("[image/eafgif] convert failed:", error);
          patchItem(item.id, {
            status: "error",
            progress: 0,
            progressMessage: "",
            errorMessage:
              error instanceof Error ? error.message : String(error),
          });
          failed += 1;
        }
        batchFileIndex += 1;
        updateOverallFromFile(0);
      }
      if (!aborted) {
        overallProgress.value = 100;
      }
    } finally {
      if (token === convertToken) {
        converting.value = false;
      }
      activeJobId.value = null;
      activeConvertItemId.value = null;
    }
    return { success, failed, aborted };
  }

  onBeforeUnmount(() => {
    unlistenProgress?.();
    unlistenProgress = null;
    for (const item of items.value) {
      revokeItem(item);
    }
  });

  return {
    items,
    loading,
    selectedId,
    selectedItem,
    converting,
    overallProgress,
    overallMessage,
    stopConvert,
    fps,
    frameStep,
    outputWidth,
    outputHeight,
    lockAspect,
    colors,
    dither,
    frameDiff,
    lossy,
    hasItems,
    doneCount,
    pickEafs,
    addPaths,
    removeItem,
    clearAll,
    selectItem,
    resetOutputSize,
    setOutputWidth,
    setOutputHeight,
    convertAll,
    baseNameFrom,
  };
}
