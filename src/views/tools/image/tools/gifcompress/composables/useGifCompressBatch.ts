import { computed, onBeforeUnmount, ref } from "vue";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { base64ToBytesAsync } from "@/utils/image/shared/base64";
import { durationSecFromDelays } from "@/utils/image/shared/formatDuration";

export type GifCompressItemStatus =
  | "idle"
  | "converting"
  | "done"
  | "error";

export type DelayMode = "keep" | "fixed";

export interface GifCompressResultLocal {
  bytes: Uint8Array;
  objectUrl: string;
  width: number;
  height: number;
  frameCount: number;
  byteLength: number;
}

export interface GifCompressBatchItem {
  id: string;
  fileName: string;
  objectUrl: string;
  path: string;
  naturalWidth: number;
  naturalHeight: number;
  frameCount: number;
  delayMinMs: number;
  delayMaxMs: number;
  delayAvgMs: number;
  fpsEstimate: number;
  /** 总时长（秒），由各帧 delay 累加 */
  durationSec: number;
  loopCount: number | null;
  hasGlobalPalette: boolean;
  hasTransparency: boolean;
  byteLength: number;
  status: GifCompressItemStatus;
  progress?: number;
  progressMessage?: string;
  result?: GifCompressResultLocal;
  errorMessage?: string;
}

export interface GifRichProbeResult {
  path: string;
  fileName: string;
  width: number;
  height: number;
  frameCount: number;
  delaysMs: number[];
  delayMinMs: number;
  delayMaxMs: number;
  delayAvgMs: number;
  fpsEstimate: number;
  loopCount: number | null;
  hasGlobalPalette: boolean;
  hasTransparency: boolean;
  byteLength: number;
}

interface RustGifCompressResult {
  width: number;
  height: number;
  frameCount: number;
  byteLength: number;
  gifBase64: string;
}

interface GifCompressProgressEvent {
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
const PROBE_CONCURRENCY = 3;
const OUTPUT_SIZE_MAX = 4096;

function baseNameFrom(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

function fileNameFromPath(path: string) {
  return path.split(/[/\\]/).pop() || path;
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

function itemFromProbe(info: GifRichProbeResult): GifCompressBatchItem {
  return {
    id: `gifc-${nextId++}`,
    fileName: info.fileName || fileNameFromPath(info.path),
    objectUrl: convertFileSrc(info.path),
    path: info.path,
    naturalWidth: info.width,
    naturalHeight: info.height,
    frameCount: info.frameCount,
    delayMinMs: info.delayMinMs,
    delayMaxMs: info.delayMaxMs,
    delayAvgMs: info.delayAvgMs,
    fpsEstimate: info.fpsEstimate,
    durationSec: durationSecFromDelays(
      info.delaysMs,
      info.frameCount,
      info.delayAvgMs
    ),
    loopCount: info.loopCount ?? null,
    hasGlobalPalette: info.hasGlobalPalette,
    hasTransparency: info.hasTransparency,
    byteLength: Number(info.byteLength) || 0,
    status: "idle",
    progress: 0,
    progressMessage: "",
  };
}

export function useGifCompressBatch() {
  const items = ref<GifCompressBatchItem[]>([]);
  const loading = ref(false);
  const selectedId = ref<string | null>(null);
  const converting = ref(false);
  const overallProgress = ref(0);
  const overallMessage = ref("");
  /** 递增后中断批量（当前 invoke 仍会跑完，结果丢弃且不再继续） */
  let convertToken = 0;

  /** 0 = 不抽帧；N≥1 = 保留 N 帧后跳过 1 帧 */
  const frameStep = ref(0);
  const outputWidth = ref<number | null>(null);
  const outputHeight = ref<number | null>(null);
  const lockAspect = ref(true);
  const colors = ref<8 | 16 | 32 | 64 | 128 | 256>(64);
  const dither = ref(false);
  const frameDiff = ref(true);
  const lossy = ref(40);
  const delayMode = ref<DelayMode>("keep");
  const fixedDelayMs = ref(100);

  const hasItems = computed(() => items.value.length > 0);
  const selectedItem = computed(
    () => items.value.find((item) => item.id === selectedId.value) ?? null
  );
  const doneCount = computed(
    () => items.value.filter((item) => item.status === "done").length
  );

  let unlistenProgress: UnlistenFn | null = null;
  const activeJobPath = ref<string | null>(null);
  const activeJobId = ref<string | null>(null);
  let batchFileIndex = 0;
  let batchFileCount = 1;

  function patchItem(id: string, patch: Partial<GifCompressBatchItem>) {
    const index = items.value.findIndex((entry) => entry.id === id);
    if (index < 0) {
      return;
    }
    const prev = items.value[index]!;
    if (patch.result && prev.result?.objectUrl) {
      URL.revokeObjectURL(prev.result.objectUrl);
    }
    items.value[index] = { ...prev, ...patch };
  }

  function updateOverallFromFile(filePercent: number) {
    const base = batchFileIndex / batchFileCount;
    const portion = filePercent / 100 / batchFileCount;
    overallProgress.value = Math.round(clamp((base + portion) * 100, 0, 100));
  }

  async function ensureProgressListener() {
    if (unlistenProgress) {
      return;
    }
    unlistenProgress = await listen<GifCompressProgressEvent>(
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
        const item = items.value.find(
          (entry) =>
            entry.path === payload.path || entry.path === activeJobPath.value
        );
        if (item) {
          patchItem(item.id, {
            progress: Math.round(payload.percent),
            progressMessage: payload.message,
          });
        }
        overallMessage.value = payload.message;
        updateOverallFromFile(payload.percent);
      }
    );
  }

  function revokeItem(item: GifCompressBatchItem) {
    URL.revokeObjectURL(item.objectUrl);
    if (item.result?.objectUrl) {
      URL.revokeObjectURL(item.result.objectUrl);
    }
  }

  async function addPaths(paths: string[]) {
    const gifPaths = paths.filter((p) => /\.gif$/i.test(p));
    if (!gifPaths.length) {
      throw new Error("NOT_GIF");
    }
    loading.value = true;
    try {
      const probed = await mapPool(gifPaths, PROBE_CONCURRENCY, async (path) =>
        invoke<GifRichProbeResult>("probe_gif_rich", { path })
      );
      const added = probed.map(itemFromProbe);
      items.value = [...items.value, ...added];
      if (!selectedId.value && added[0]) {
        selectedId.value = added[0].id;
      }
    } finally {
      loading.value = false;
    }
  }

  async function pickGifs() {
    const selected = await open({
      multiple: true,
      filters: [{ name: "GIF", extensions: ["gif"] }],
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
    activeJobPath.value = null;
    for (const item of items.value) {
      if (item.status === "converting") {
        patchItem(item.id, {
          status: "idle",
          progress: 0,
          progressMessage: "",
          errorMessage: undefined,
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
    if (lockAspect.value && selectedItem.value && w > 0) {
      const item = selectedItem.value;
      if (item.naturalWidth > 0) {
        outputHeight.value = clampOutputSize(
          (w * item.naturalHeight) / item.naturalWidth
        );
      }
    }
  }

  function setOutputHeight(height: number | null) {
    if (height == null || !Number.isFinite(height)) {
      outputHeight.value = null;
      return;
    }
    const h = clampOutputSize(height);
    outputHeight.value = h;
    if (lockAspect.value && selectedItem.value && h > 0) {
      const item = selectedItem.value;
      if (item.naturalHeight > 0) {
        outputWidth.value = clampOutputSize(
          (h * item.naturalWidth) / item.naturalHeight
        );
      }
    }
  }

  async function convertAll() {
    if (!items.value.length || converting.value) {
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
    const queue = [...items.value];
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
        const jobId = `gifc-job-${jobSeq++}`;
        activeJobId.value = jobId;
        activeJobPath.value = item.path;
        patchItem(item.id, {
          status: "converting",
          progress: 0,
          progressMessage: "",
          errorMessage: undefined,
        });
        overallMessage.value = item.fileName;
        try {
          const result = await invoke<RustGifCompressResult>("compress_gif", {
            path: item.path,
            jobId,
            options: {
              frameStep: frameStep.value,
              width: outputWidth.value ?? undefined,
              height: outputHeight.value ?? undefined,
              colors: colors.value,
              dither: dither.value,
              frameDiff: frameDiff.value,
              lossy: lossy.value,
              delayMode: delayMode.value,
              fixedDelayMs: fixedDelayMs.value,
            },
          });
          if (token !== convertToken) {
            aborted = true;
            break;
          }
          if (!items.value.some((entry) => entry.id === item.id)) {
            aborted = true;
            break;
          }
          const bytes = await base64ToBytesAsync(result.gifBase64);
          const objectUrl = URL.createObjectURL(
            new Blob([new Uint8Array(bytes)], { type: "image/gif" })
          );
          patchItem(item.id, {
            status: "done",
            progress: 100,
            progressMessage: "",
            result: {
              bytes,
              objectUrl,
              width: result.width,
              height: result.height,
              frameCount: result.frameCount,
              byteLength: Number(result.byteLength) || bytes.length,
            },
          });
          success += 1;
        } catch (error) {
          if (token !== convertToken) {
            aborted = true;
            break;
          }
          console.error("[image/gifcompress] convert failed:", error);
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
      activeJobPath.value = null;
    }
    return { success, failed, aborted };
  }

  onBeforeUnmount(() => {
    unlistenProgress?.();
    unlistenProgress = null;
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
    frameStep,
    outputWidth,
    outputHeight,
    lockAspect,
    colors,
    dither,
    frameDiff,
    lossy,
    delayMode,
    fixedDelayMs,
    hasItems,
    doneCount,
    pickGifs,
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
