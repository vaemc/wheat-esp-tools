import { computed, onBeforeUnmount, ref } from "vue";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  EafDecodeResult,
  EafEncodingMode,
  EafColorDepth,
} from "@/utils/image/eaf";
import {
  EAF_DEFAULT_COLOR_DEPTH,
  EAF_DEFAULT_ENCODING,
  EAF_DEFAULT_JPEG_QUALITY,
  EAF_DEFAULT_SPLIT_HEIGHT,
  decodeEaf,
} from "@/utils/image/eaf";

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
  status: EafItemStatus;
  /** 单文件 0–100 */
  progress: number;
  progressMessage: string;
  result?: EafEncodeResultLocal;
  preview?: EafDecodeResult;
  errorMessage?: string;
}

interface GifProbeResult {
  path: string;
  fileName: string;
  width: number;
  height: number;
  frameCount: number;
}

interface RustEafConvertResult {
  width: number;
  height: number;
  frameCount: number;
  splitHeight: number;
  colorDepth: number;
  encodingMode: string;
  sizeBytes: number;
  eafBase64: string;
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

/** 并行探测上限，避免一次性打爆磁盘/UI */
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

async function base64ToBytesAsync(base64: string): Promise<Uint8Array> {
  const chunkChars = 256 * 1024;
  if (base64.length <= chunkChars) {
    const bin = atob(base64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  }

  const parts: Uint8Array[] = [];
  let total = 0;
  let offset = 0;
  while (offset < base64.length) {
    let end = Math.min(offset + chunkChars, base64.length);
    if (end < base64.length) {
      end -= end % 4;
      if (end <= offset) {
        end = Math.min(offset + 4, base64.length);
      }
    }
    const bin = atob(base64.slice(offset, end));
    const chunk = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      chunk[i] = bin.charCodeAt(i);
    }
    parts.push(chunk);
    total += chunk.length;
    offset = end;
    await yieldToUi();
  }

  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
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
  /** 批量总进度 0–100 */
  const overallProgress = ref(0);
  const overallMessage = ref("");

  const outputWidth = ref<number | null>(null);
  const outputHeight = ref<number | null>(null);
  const lockAspect = ref(true);
  const splitHeight = ref(EAF_DEFAULT_SPLIT_HEIGHT);
  const colorDepth = ref<EafColorDepth>(EAF_DEFAULT_COLOR_DEPTH);
  const encodingMode = ref<EafEncodingMode>(EAF_DEFAULT_ENCODING);
  const jpegQuality = ref(EAF_DEFAULT_JPEG_QUALITY);

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
      status: "loading",
      progress: 0,
      progressMessage: "读取中…",
    };
  }

  async function probeIntoItem(item: EafBatchItem) {
    try {
      const info = await invoke<GifProbeResult>("probe_gif", {
        path: item.path,
      });
      patchItem(item.id, {
        fileName: info.fileName || item.fileName,
        path: info.path || item.path,
        naturalWidth: info.width,
        naturalHeight: info.height,
        frameCount: info.frameCount,
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

      // 先立刻挂卡片：缩略图用资源协议，不等探测完成
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
    items.value = items.value.filter((entry) => entry.id !== id);
    if (selectedId.value === id) {
      selectedId.value = items.value[0]?.id ?? null;
    }
  }

  function clearAll() {
    items.value = [];
    selectedId.value = null;
  }

  function selectItem(id: string) {
    selectedId.value = id;
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

  async function convertItem(item: EafBatchItem): Promise<{
    result: EafEncodeResultLocal;
    preview: EafDecodeResult;
  }> {
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
      },
    });

    patchItem(item.id, {
      progress: 98,
      progressMessage: "生成预览…",
    });
    overallMessage.value = "生成预览…";
    await yieldToUi();

    const bytes = await base64ToBytesAsync(rust.eafBase64);
    const previewFrames: HTMLCanvasElement[] = [];
    let previewMeta = {
      width: rust.width,
      height: rust.height,
      bitDepth: rust.colorDepth,
      splitHeight: rust.splitHeight,
    };

    // 先落盘结果，再协作式解码预览，避免大 EAF 卡死 UI
    patchItem(item.id, {
      progress: 99,
      progressMessage: "解码预览…",
      result: {
        bytes,
        width: rust.width,
        height: rust.height,
        frameCount: rust.frameCount,
        splitHeight: rust.splitHeight,
        colorDepth: rust.colorDepth,
        encodingMode: rust.encodingMode,
        sizeBytes: rust.sizeBytes,
      },
      preview: {
        frames: previewFrames,
        width: rust.width,
        height: rust.height,
        frameCount: 0,
        bitDepth: rust.colorDepth,
        splitHeight: rust.splitHeight,
      },
    });

    const preview = await decodeEaf(bytes, {
      onProgress(current, total) {
        const percent = 98 + Math.round((current / Math.max(1, total)) * 2);
        patchItem(item.id, {
          progress: Math.min(99, percent),
          progressMessage: `解码预览 ${current}/${total}…`,
        });
        overallMessage.value = `解码预览 ${current}/${total}…`;
      },
      onFrame(canvas, _index, meta) {
        previewFrames.push(canvas);
        previewMeta = {
          width: meta.width,
          height: meta.height,
          bitDepth: meta.bitDepth,
          splitHeight: meta.splitHeight,
        };
        patchItem(item.id, {
          preview: {
            frames: [...previewFrames],
            width: previewMeta.width,
            height: previewMeta.height,
            frameCount: previewFrames.length,
            bitDepth: previewMeta.bitDepth,
            splitHeight: previewMeta.splitHeight,
          },
        });
      },
    });
    await yieldToUi();

    return {
      result: {
        bytes,
        width: rust.width,
        height: rust.height,
        frameCount: rust.frameCount,
        splitHeight: rust.splitHeight,
        colorDepth: rust.colorDepth,
        encodingMode: rust.encodingMode,
        sizeBytes: rust.sizeBytes,
      },
      preview,
    };
  }

  async function convertAll() {
    await ensureProgressListener();
    converting.value = true;
    overallProgress.value = 0;
    overallMessage.value = "准备转换…";

    // 跳过仍在 loading 的条目
    const ready = items.value.filter((item) => item.status !== "loading");
    batchFileCount = Math.max(1, ready.length);
    batchFileIndex = 0;

    let success = 0;
    let failed = 0;

    try {
      for (const item of [...ready]) {
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
          preview: undefined,
          errorMessage: undefined,
        };
        overallMessage.value = `转换 ${item.fileName}…`;

        try {
          const { result, preview } = await convertItem(item);
          items.value[index] = {
            ...items.value[index],
            status: "done",
            progress: 100,
            progressMessage: "完成",
            result,
            preview,
          };
          success += 1;
        } catch (error) {
          items.value[index] = {
            ...items.value[index],
            status: "error",
            progress: 0,
            progressMessage: "",
            result: undefined,
            preview: undefined,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          };
          failed += 1;
        }

        batchFileIndex += 1;
        updateOverallFromFile(0);
        await yieldToUi();
      }
      overallProgress.value = 100;
      overallMessage.value =
        failed === 0 ? "全部完成" : `完成（失败 ${failed}）`;
    } finally {
      converting.value = false;
      activeJobId.value = null;
      activeJobPath.value = null;
    }

    return { success, failed };
  }

  onBeforeUnmount(() => {
    unlistenProgress?.();
    unlistenProgress = null;
  });

  return {
    items,
    loading,
    converting,
    overallProgress,
    overallMessage,
    selectedId,
    selectedItem,
    outputWidth,
    outputHeight,
    lockAspect,
    splitHeight,
    colorDepth,
    encodingMode,
    jpegQuality,
    hasItems,
    doneCount,
    pickGifs,
    addPaths,
    removeItem,
    clearAll,
    selectItem,
    setOutputWidth,
    setOutputHeight,
    resetOutputSize,
    setEncodingMode,
    setColorDepth,
    convertAll,
    baseNameFrom,
  };
}
