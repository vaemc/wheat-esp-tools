import { computed, onBeforeUnmount, ref, shallowRef } from "vue";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile, remove } from "@tauri-apps/plugin-fs";
import type {
  EafDecodeResult,
  EafEncodingMode,
  EafColorDepth,
} from "@/utils/image/eaf";
import {
  EAF_DEFAULT_COLOR_DEPTH,
  EAF_DEFAULT_ENCODING,
  EAF_DEFAULT_FRAME_STEP,
  EAF_DEFAULT_JPEG_QUALITY,
  EAF_DEFAULT_SIMILAR_THRESHOLD,
  EAF_DEFAULT_SPLIT_HEIGHT,
  decodeEaf,
} from "@/utils/image/eaf";
import { durationSecFromDelays } from "@/utils/image/shared/formatDuration";

export type EafItemStatus =
  | "loading"
  | "idle"
  | "converting"
  | "done"
  | "error";

export interface EafEncodeResultLocal {
  bytes: Uint8Array;
  width: number;
  height: number;
  frameCount: number;
  splitHeight: number;
  colorDepth: number;
  encodingMode: string;
  sizeBytes: number;
}

export interface EafBatchItem {
  id: string;
  fileName: string;
  objectUrl: string;
  path: string;
  naturalWidth: number;
  naturalHeight: number;
  frameCount: number;
  durationSec: number;
  fpsEstimate: number;
  delayAvgMs: number;
  status: EafItemStatus;
  progress: number;
  progressMessage: string;
  result?: EafEncodeResultLocal;
  errorMessage?: string;
}

interface GifProbeResult {
  path: string;
  fileName: string;
  width: number;
  height: number;
  frameCount: number;
  delayAvgMs?: number;
  fpsEstimate?: number;
  delaysMs?: number[];
}

interface RustEafConvertResult {
  width: number;
  height: number;
  frameCount: number;
  splitHeight: number;
  colorDepth: number;
  encodingMode: string;
  sizeBytes: number;
  eafPath: string;
}

interface EafProgressEvent {
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function baseNameFrom(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

function fileNameFromPath(path: string) {
  return path.split(/[/\\]/).pop() || path;
}

function yieldToUi() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
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
      results[index] = await worker(list[index], index);
    }
  }

  const runners = Array.from(
    { length: Math.min(concurrency, Math.max(1, list.length)) },
    () => run()
  );
  await Promise.all(runners);
  return results;
}

export function useEafBatch() {
  const items = ref<EafBatchItem[]>([]);
  const loading = ref(false);
  const selectedId = ref<string | null>(null);
  const converting = ref(false);
  const overallProgress = ref(0);
  const overallMessage = ref("");
  let convertToken = 0;
  const previewDecoding = ref(false);
  const previewDecodeProgress = ref({ current: 0, total: 0 });
  let previewDecodeAbort: AbortController | null = null;
  const livePreview = shallowRef<EafDecodeResult | null>(null);
  let livePreviewItemId: string | null = null;
  const previewCache = new Map<string, EafDecodeResult>();

  const outputWidth = ref<number | null>(null);
  const outputHeight = ref<number | null>(null);
  const lockAspect = ref(true);
  const splitHeight = ref(EAF_DEFAULT_SPLIT_HEIGHT);
  const colorDepth = ref<EafColorDepth>(EAF_DEFAULT_COLOR_DEPTH);
  const encodingMode = ref<EafEncodingMode>(EAF_DEFAULT_ENCODING);
  const jpegQuality = ref(EAF_DEFAULT_JPEG_QUALITY);
  const frameStep = ref(EAF_DEFAULT_FRAME_STEP);
  const similarThreshold = ref(EAF_DEFAULT_SIMILAR_THRESHOLD);

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

  function patchItem(id: string, patch: Partial<EafBatchItem>) {
    const index = items.value.findIndex((entry) => entry.id === id);
    if (index < 0) {
      return;
    }
    items.value[index] = { ...items.value[index], ...patch };
  }

  function updateOverallFromFile(filePercent: number) {
    const base = batchFileIndex / batchFileCount;
    const portion = filePercent / 100 / batchFileCount;
    overallProgress.value = Math.round(
      clamp((base + portion) * 100, 0, 100)
    );
  }

  async function ensureProgressListener() {
    if (unlistenProgress) {
      return;
    }
    unlistenProgress = await listen<EafProgressEvent>(
      "eaf_convert_progress",
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
            entry.path === payload.path ||
            entry.path === activeJobPath.value
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

  function createPlaceholder(path: string): EafBatchItem {
    const fileName = fileNameFromPath(path);
    return {
      id: `eaf-${nextId++}`,
      fileName,
      objectUrl: convertFileSrc(path),
      path,
      naturalWidth: 0,
      naturalHeight: 0,
      frameCount: 0,
      durationSec: 0,
      fpsEstimate: 0,
      delayAvgMs: 0,
      status: "loading",
      progress: 0,
      progressMessage: "读取中…",
    };
  }

  async function probeIntoItem(item: EafBatchItem) {
    try {
      const info = await invoke<GifProbeResult>("probe_gif_rich", {
        path: item.path,
      });
      const delayAvgMs = Number(info.delayAvgMs) || 0;
      const fpsEstimate = Number(info.fpsEstimate) || 0;
      const durationSec = durationSecFromDelays(
        info.delaysMs,
        info.frameCount,
        delayAvgMs
      );
      patchItem(item.id, {
        fileName: info.fileName || item.fileName,
        path: info.path || item.path,
        naturalWidth: info.width,
        naturalHeight: info.height,
        frameCount: info.frameCount,
        durationSec,
        fpsEstimate,
        delayAvgMs,
        status: "idle",
        progressMessage: "",
      });
    } catch (error) {
      patchItem(item.id, {
        status: "error",
        progressMessage: "",
        errorMessage:
          error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function addPaths(paths: string[]) {
    loading.value = true;
    try {
      const gifPaths = paths.filter((p) => /\.gif$/i.test(p));
      if (gifPaths.length === 0) {
        throw new Error("NOT_GIF");
      }

      const placeholders = gifPaths.map(createPlaceholder);
      items.value = [...items.value, ...placeholders];
      if (!selectedId.value && placeholders.length) {
        selectedId.value = placeholders[0].id;
      }
      await yieldToUi();

      await mapPool(placeholders, PROBE_CONCURRENCY, async (item) => {
        await probeIntoItem(item);
        await yieldToUi();
        return item.id;
      });

      const okCount = placeholders.filter((item) => {
        const current = items.value.find((entry) => entry.id === item.id);
        return current && current.status !== "error";
      }).length;

      if (okCount === 0) {
        const firstErr = items.value.find(
          (entry) => entry.id === placeholders[0]?.id
        )?.errorMessage;
        throw new Error(firstErr || "NOT_GIF");
      }

      return okCount;
    } finally {
      loading.value = false;
    }
  }

  async function pickGifs(): Promise<number> {
    const selected = await open({
      multiple: true,
      filters: [{ name: "GIF", extensions: ["gif"] }],
    });
    if (selected == null) {
      return 0;
    }
    const paths = Array.isArray(selected) ? selected : [selected];
    return addPaths(paths);
  }

  function removeItem(id: string) {
    previewCache.delete(id);
    if (selectedId.value === id) {
      clearLivePreview();
    }
    items.value = items.value.filter((entry) => entry.id !== id);
    if (selectedId.value === id) {
      selectedId.value = items.value[0]?.id ?? null;
      if (selectedId.value) {
        void ensurePreview(selectedId.value);
      }
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
    clearLivePreview();
    previewCache.clear();
    items.value = [];
    selectedId.value = null;
    overallProgress.value = 0;
    overallMessage.value = "";
  }

  function selectItem(id: string) {
    if (selectedId.value !== id) {
      abortItemPreviewDecode();
      livePreview.value = null;
      livePreviewItemId = null;
    }
    selectedId.value = id;
    void ensurePreview(id);
  }

  function setOutputWidth(width: number | null) {
    if (width === null || Number.isNaN(width)) {
      outputWidth.value = null;
      return;
    }
    const w = clamp(Math.round(width), 1, 4096);
    outputWidth.value = w;
    if (lockAspect.value && selectedItem.value) {
      const item = selectedItem.value;
      if (item.naturalWidth > 0 && item.naturalHeight > 0) {
        outputHeight.value = Math.max(
          1,
          Math.round((w * item.naturalHeight) / item.naturalWidth)
        );
      }
    }
  }

  function setOutputHeight(height: number | null) {
    if (height === null || Number.isNaN(height)) {
      outputHeight.value = null;
      return;
    }
    const h = clamp(Math.round(height), 1, 4096);
    outputHeight.value = h;
    if (lockAspect.value && selectedItem.value) {
      const item = selectedItem.value;
      if (item.naturalWidth > 0 && item.naturalHeight > 0) {
        outputWidth.value = Math.max(
          1,
          Math.round((h * item.naturalWidth) / item.naturalHeight)
        );
      }
    }
  }

  function resetOutputSize() {
    outputWidth.value = null;
    outputHeight.value = null;
  }

  function setEncodingMode(mode: EafEncodingMode) {
    encodingMode.value = mode;
    if (mode === "jpeg") {
      colorDepth.value = 24;
    } else if (colorDepth.value === 24) {
      colorDepth.value = 8;
    }
  }

  function setColorDepth(depth: EafColorDepth) {
    if (encodingMode.value === "jpeg") {
      colorDepth.value = 24;
      return;
    }
    if (depth === 4 || depth === 8) {
      colorDepth.value = depth;
    }
  }

  function abortItemPreviewDecode() {
    previewDecodeAbort?.abort();
    previewDecodeAbort = null;
    previewDecoding.value = false;
    previewDecodeProgress.value = { current: 0, total: 0 };
  }

  function clearLivePreview() {
    abortItemPreviewDecode();
    livePreview.value = null;
    livePreviewItemId = null;
  }

  function hasCompletePreview(id: string, frameCount: number) {
    const cached = previewCache.get(id);
    return !!cached && frameCount > 0 && cached.frames.length >= frameCount;
  }

  function publishLivePreview(
    id: string,
    frames: HTMLCanvasElement[],
    meta: {
      width: number;
      height: number;
      bitDepth: number;
      splitHeight: number;
    }
  ) {
    livePreviewItemId = id;
    livePreview.value = {
      frames,
      width: meta.width,
      height: meta.height,
      frameCount: frames.length,
      bitDepth: meta.bitDepth,
      splitHeight: meta.splitHeight,
    };
  }

  async function ensurePreview(id: string) {
    const item = items.value.find((entry) => entry.id === id);
    if (!item?.result) {
      livePreview.value = null;
      livePreviewItemId = null;
      return;
    }
    if (item.status === "converting" || item.status === "loading") {
      return;
    }

    const expected = item.result.frameCount;
    const cached = previewCache.get(id);
    if (cached && hasCompletePreview(id, expected)) {
      abortItemPreviewDecode();
      livePreviewItemId = id;
      livePreview.value = cached;
      return;
    }

    if (
      previewDecoding.value &&
      livePreviewItemId === id &&
      previewDecodeAbort
    ) {
      return;
    }

    abortItemPreviewDecode();
    const controller = new AbortController();
    previewDecodeAbort = controller;
    previewDecoding.value = true;
    previewDecodeProgress.value = {
      current: 0,
      total: expected,
    };

    const previewFrames: HTMLCanvasElement[] = [];
    const previewMeta = {
      width: item.result.width,
      height: item.result.height,
      bitDepth: item.result.colorDepth,
      splitHeight: item.result.splitHeight,
    };
    publishLivePreview(id, previewFrames, previewMeta);

    try {
      const preview = await decodeEaf(item.result.bytes, {
        signal: controller.signal,
        onProgress(current, total) {
          if (controller.signal.aborted) {
            return;
          }
          previewDecodeProgress.value = { current, total };
        },
        onFrame(canvas, _index, meta) {
          if (controller.signal.aborted || selectedId.value !== id) {
            return;
          }
          previewFrames.push(canvas);
          previewMeta.width = meta.width;
          previewMeta.height = meta.height;
          previewMeta.bitDepth = meta.bitDepth;
          previewMeta.splitHeight = meta.splitHeight;
          if (
            previewFrames.length === 1 ||
            previewFrames.length % 4 === 0 ||
            previewFrames.length === expected
          ) {
            publishLivePreview(id, previewFrames, previewMeta);
          }
        },
      });

      if (controller.signal.aborted || selectedId.value !== id) {
        return;
      }

      previewCache.set(id, preview);
      livePreviewItemId = id;
      livePreview.value = preview;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      if (selectedId.value === id) {
        console.error("[image/eaf] preview decode failed:", error);
        livePreview.value = null;
        livePreviewItemId = null;
      }
    } finally {
      if (previewDecodeAbort === controller) {
        previewDecodeAbort = null;
        previewDecoding.value = false;
        previewDecodeProgress.value = { current: 0, total: 0 };
      }
    }
  }

  async function convertItem(item: EafBatchItem): Promise<EafEncodeResultLocal> {
    const jobId = `job-${jobSeq++}`;
    activeJobId.value = jobId;
    activeJobPath.value = item.path;

    patchItem(item.id, {
      progress: 0,
      progressMessage: "排队中…",
    });

    const rust = await invoke<RustEafConvertResult>("convert_gif_to_eaf", {
      path: item.path,
      jobId,
      options: {
        width: outputWidth.value ?? null,
        height: outputHeight.value ?? null,
        splitHeight: splitHeight.value,
        colorDepth: colorDepth.value,
        encodingMode: encodingMode.value,
        jpegQuality: jpegQuality.value,
        frameStep: frameStep.value,
        similarThreshold: similarThreshold.value,
      },
    });

    patchItem(item.id, {
      progress: 99,
      progressMessage: "读取结果…",
    });
    overallMessage.value = "读取结果…";
    await yieldToUi();

    const bytes = await readFile(rust.eafPath);
    try {
      await remove(rust.eafPath);
    } catch {
      // temp cleanup best-effort
    }
    return {
      bytes,
      width: rust.width,
      height: rust.height,
      frameCount: rust.frameCount,
      splitHeight: rust.splitHeight,
      colorDepth: rust.colorDepth,
      encodingMode: rust.encodingMode,
      sizeBytes: rust.sizeBytes,
    };
  }

  async function convertAll() {
    if (!items.value.length || converting.value) {
      return { success: 0, failed: 0, aborted: false };
    }
    await ensureProgressListener();
    const token = ++convertToken;
    converting.value = true;
    overallProgress.value = 0;
    overallMessage.value = "准备转换…";

    const ready = items.value.filter((item) => item.status !== "loading");
    batchFileCount = Math.max(1, ready.length);
    batchFileIndex = 0;

    let success = 0;
    let failed = 0;
    let aborted = false;

    try {
      for (const item of [...ready]) {
        if (token !== convertToken) {
          aborted = true;
          break;
        }
        if (!items.value.some((entry) => entry.id === item.id)) {
          aborted = true;
          break;
        }
        const index = items.value.findIndex((entry) => entry.id === item.id);
        if (index < 0) {
          continue;
        }
        items.value[index] = {
          ...item,
          status: "converting",
          progress: 0,
          progressMessage: "开始…",
          result: undefined,
          errorMessage: undefined,
        };
        previewCache.delete(item.id);
        if (selectedId.value === item.id) {
          clearLivePreview();
        }
        overallMessage.value = `转换 ${item.fileName}…`;

        try {
          const result = await convertItem(item);
          if (token !== convertToken) {
            aborted = true;
            break;
          }
          if (!items.value.some((entry) => entry.id === item.id)) {
            aborted = true;
            break;
          }
          const liveIndex = items.value.findIndex((entry) => entry.id === item.id);
          if (liveIndex < 0) {
            aborted = true;
            break;
          }
          items.value[liveIndex] = {
            ...items.value[liveIndex],
            status: "done",
            progress: 100,
            progressMessage: "完成",
            result,
          };
          success += 1;
          if (selectedId.value === item.id) {
            void ensurePreview(item.id);
          }
        } catch (error) {
          if (token !== convertToken) {
            aborted = true;
            break;
          }
          const liveIndex = items.value.findIndex((entry) => entry.id === item.id);
          if (liveIndex >= 0) {
            items.value[liveIndex] = {
              ...items.value[liveIndex],
              status: "error",
              progress: 0,
              progressMessage: "",
              result: undefined,
              errorMessage:
                error instanceof Error ? error.message : String(error),
            };
          }
          failed += 1;
        }

        batchFileIndex += 1;
        updateOverallFromFile(0);
        await yieldToUi();
      }
      if (!aborted) {
        overallProgress.value = 100;
        overallMessage.value =
          failed === 0 ? "全部完成" : `完成（失败 ${failed}）`;
      }
    } finally {
      if (token === convertToken) {
        converting.value = false;
        activeJobId.value = null;
        activeJobPath.value = null;
      }
    }

    return { success, failed, aborted };
  }

  onBeforeUnmount(() => {
    abortItemPreviewDecode();
    unlistenProgress?.();
    unlistenProgress = null;
  });

  return {
    items,
    loading,
    converting,
    overallProgress,
    overallMessage,
    previewDecoding,
    previewDecodeProgress,
    livePreview,
    selectedId,
    selectedItem,
    outputWidth,
    outputHeight,
    lockAspect,
    splitHeight,
    colorDepth,
    encodingMode,
    jpegQuality,
    frameStep,
    similarThreshold,
    hasItems,
    doneCount,
    pickGifs,
    addPaths,
    removeItem,
    clearAll,
    selectItem,
    clearLivePreview,
    setOutputWidth,
    setOutputHeight,
    resetOutputSize,
    setEncodingMode,
    setColorDepth,
    convertAll,
    stopConvert,
    baseNameFrom,
  };
}
