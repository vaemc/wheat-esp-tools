import { computed, onBeforeUnmount, ref, shallowRef } from "vue";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  EafColorDepth,
  EafDecodeResult,
  EafEncodingMode,
  EafEncodeResult,
} from "@/utils/image/eaf";
import {
  EAF_DEFAULT_COLOR_DEPTH,
  EAF_DEFAULT_ENCODING,
  EAF_DEFAULT_FRAME_STEP,
  EAF_DEFAULT_JPEG_QUALITY,
  EAF_DEFAULT_SAMPLE_FPS,
  EAF_DEFAULT_SIMILAR_THRESHOLD,
  EAF_DEFAULT_SPLIT_HEIGHT,
  decodeEaf,
  encodeFramesToEaf,
  extractMp4Frames,
  probeMp4,
} from "@/utils/image/eaf";

export type Mp4EafItemStatus =
  | "loading"
  | "idle"
  | "converting"
  | "done"
  | "error";

export interface Mp4EafBatchItem {
  id: string;
  fileName: string;
  objectUrl: string;
  path: string;
  videoSrc: string;
  naturalWidth: number;
  naturalHeight: number;
  frameCount: number;
  durationSec: number;
  fpsEstimate: number;
  delayAvgMs: number;
  status: Mp4EafItemStatus;
  progress: number;
  progressMessage: string;
  result?: EafEncodeResult;
  errorMessage?: string;
}

let nextId = 1;

const PROBE_CONCURRENCY = 2;

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

export function useMp4EafBatch() {
  const items = ref<Mp4EafBatchItem[]>([]);
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
  const sampleFps = ref(EAF_DEFAULT_SAMPLE_FPS);

  const hasItems = computed(() => items.value.length > 0);
  const selectedItem = computed(
    () => items.value.find((item) => item.id === selectedId.value) ?? null
  );
  const doneCount = computed(
    () => items.value.filter((item) => item.status === "done").length
  );

  let batchFileIndex = 0;
  let batchFileCount = 1;

  function revokeItem(item: Mp4EafBatchItem) {
    if (item.objectUrl.startsWith("blob:")) {
      URL.revokeObjectURL(item.objectUrl);
    }
  }

  function patchItem(id: string, patch: Partial<Mp4EafBatchItem>) {
    const index = items.value.findIndex((entry) => entry.id === id);
    if (index < 0) {
      return;
    }
    const prev = items.value[index];
    if (
      patch.objectUrl &&
      patch.objectUrl !== prev.objectUrl &&
      prev.objectUrl.startsWith("blob:")
    ) {
      URL.revokeObjectURL(prev.objectUrl);
    }
    items.value[index] = { ...prev, ...patch };
  }

  function updateOverallFromFile(filePercent: number) {
    const base = batchFileIndex / batchFileCount;
    const portion = filePercent / 100 / batchFileCount;
    overallProgress.value = Math.round(
      clamp((base + portion) * 100, 0, 100)
    );
  }

  function createPlaceholder(path: string): Mp4EafBatchItem {
    const fileName = fileNameFromPath(path);
    return {
      id: `mp4eaf-${nextId++}`,
      fileName,
      objectUrl:
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      path,
      videoSrc: convertFileSrc(path),
      naturalWidth: 0,
      naturalHeight: 0,
      frameCount: 0,
      durationSec: 0,
      fpsEstimate: sampleFps.value,
      delayAvgMs: Math.round(1000 / Math.max(0.5, sampleFps.value)),
      status: "loading",
      progress: 0,
      progressMessage: "读取中…",
    };
  }

  async function probeIntoItem(item: Mp4EafBatchItem) {
    try {
      const info = await probeMp4(item.videoSrc, sampleFps.value);
      patchItem(item.id, {
        objectUrl: info.thumbnailUrl,
        naturalWidth: info.width,
        naturalHeight: info.height,
        frameCount: info.frameCountEstimate,
        durationSec: info.durationSec,
        fpsEstimate: info.sampleFps,
        delayAvgMs: Math.round(1000 / Math.max(0.5, info.sampleFps)),
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
      const mp4Paths = paths.filter((p) => /\.mp4$/i.test(p));
      if (mp4Paths.length === 0) {
        throw new Error("NOT_MP4");
      }

      const placeholders = mp4Paths.map(createPlaceholder);
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
        throw new Error(firstErr || "NOT_MP4");
      }

      return okCount;
    } finally {
      loading.value = false;
    }
  }

  async function pickMp4s(): Promise<number> {
    const selected = await open({
      multiple: true,
      filters: [{ name: "MP4", extensions: ["mp4"] }],
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
    const target = items.value.find((entry) => entry.id === id);
    if (target) {
      revokeItem(target);
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
    for (const item of items.value) {
      revokeItem(item);
    }
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
        console.error("[image/mp4eaf] preview decode failed:", error);
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

  async function convertItem(
    item: Mp4EafBatchItem,
    token: number
  ): Promise<EafEncodeResult> {
    const extractAbort = new AbortController();
    const checkAbort = () => {
      if (token !== convertToken) {
        extractAbort.abort();
        throw new DOMException("Aborted", "AbortError");
      }
    };

    patchItem(item.id, {
      progress: 0,
      progressMessage: "抽帧中…",
    });
    overallMessage.value = `抽帧 ${item.fileName}…`;

    const frames = await extractMp4Frames(item.videoSrc, {
      sampleFps: sampleFps.value,
      signal: extractAbort.signal,
      onProgress(current, total, message) {
        checkAbort();
        const percent = Math.round((current / Math.max(1, total)) * 35);
        patchItem(item.id, {
          progress: percent,
          progressMessage: message,
        });
        overallMessage.value = message;
        updateOverallFromFile(percent);
      },
    });

    checkAbort();
    patchItem(item.id, {
      progress: 38,
      progressMessage: "编码中…",
    });

    const result = await encodeFramesToEaf(
      frames,
      {
        width: outputWidth.value ?? undefined,
        height: outputHeight.value ?? undefined,
        splitHeight: splitHeight.value,
        colorDepth: colorDepth.value,
        encodingMode: encodingMode.value,
        jpegQuality: jpegQuality.value,
        frameStep: frameStep.value,
        similarThreshold: similarThreshold.value,
      },
      (event) => {
        checkAbort();
        const percent = Math.round(38 + event.percent * 0.6);
        patchItem(item.id, {
          progress: clamp(percent, 0, 99),
          progressMessage: event.message,
        });
        overallMessage.value = event.message;
        updateOverallFromFile(percent);
      }
    );

    return result;
  }

  async function convertAll() {
    if (!items.value.length || converting.value) {
      return { success: 0, failed: 0, aborted: false };
    }
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
          const result = await convertItem(item, token);
          if (token !== convertToken) {
            aborted = true;
            break;
          }
          if (!items.value.some((entry) => entry.id === item.id)) {
            aborted = true;
            break;
          }
          const liveIndex = items.value.findIndex(
            (entry) => entry.id === item.id
          );
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
            frameCount: result.frameCount,
          };
          success += 1;
          if (selectedId.value === item.id) {
            void ensurePreview(item.id);
          }
        } catch (error) {
          if (
            token !== convertToken ||
            (error instanceof DOMException && error.name === "AbortError")
          ) {
            aborted = true;
            break;
          }
          const liveIndex = items.value.findIndex(
            (entry) => entry.id === item.id
          );
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
      }
    }

    return { success, failed, aborted };
  }

  onBeforeUnmount(() => {
    abortItemPreviewDecode();
    for (const item of items.value) {
      revokeItem(item);
    }
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
    sampleFps,
    hasItems,
    doneCount,
    pickMp4s,
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
