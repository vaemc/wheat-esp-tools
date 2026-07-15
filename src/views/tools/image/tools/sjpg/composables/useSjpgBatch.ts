import { computed, ref } from "vue";
import type { SjpgEncodeResult } from "@/utils/image/sjpg";

export type ImageItemStatus = "idle" | "converting" | "done" | "error";

export interface ImageBatchItem {
  id: string;
  fileName: string;
  objectUrl: string;
  image: HTMLImageElement;
  naturalWidth: number;
  naturalHeight: number;
  status: ImageItemStatus;
  result?: SjpgEncodeResult;
}

let nextId = 1;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function baseNameFrom(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function isImagePath(path: string) {
  return /\.(jpe?g|png|webp|bmp|gif)$/i.test(path);
}

async function loadImageElement(blob: Blob): Promise<{
  image: HTMLImageElement;
  objectUrl: string;
}> {
  const objectUrl = URL.createObjectURL(blob);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };
    el.src = objectUrl;
  });
  return { image, objectUrl };
}

export function useSjpgBatch() {
  const items = ref<ImageBatchItem[]>([]);
  const loading = ref(false);
  const selectedId = ref<string | null>(null);

  const outputWidth = ref<number | null>(null);
  const outputHeight = ref<number | null>(null);
  const lockAspect = ref(true);
  const jpegQuality = ref(90);
  const splitHeight = ref(16);

  const hasImages = computed(() => items.value.length > 0);
  const selectedItem = computed(
    () => items.value.find((item) => item.id === selectedId.value) ?? null
  );
  const doneCount = computed(
    () => items.value.filter((item) => item.status === "done").length
  );

  function revokeItem(item: ImageBatchItem) {
    URL.revokeObjectURL(item.objectUrl);
  }

  function renderItemToCanvas(item: ImageBatchItem): HTMLCanvasElement {
    const targetW = outputWidth.value ?? item.naturalWidth;
    const targetH = outputHeight.value ?? item.naturalHeight;

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D unavailable");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(item.image, 0, 0, targetW, targetH);
    return canvas;
  }

  function getOutputSize(item: ImageBatchItem) {
    return {
      width: outputWidth.value ?? item.naturalWidth,
      height: outputHeight.value ?? item.naturalHeight,
    };
  }

  async function addFromFile(file: File) {
    if (!isImageFile(file)) {
      throw new Error("NOT_IMAGE");
    }
    const { image, objectUrl } = await loadImageElement(file);
    const item: ImageBatchItem = {
      id: `img-${nextId++}`,
      fileName: file.name,
      objectUrl,
      image,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      status: "idle",
    };
    items.value = [...items.value, item];
    if (!selectedId.value) {
      selectedId.value = item.id;
    }
    return item;
  }

  async function addFromBlob(blob: Blob, name: string) {
    const { image, objectUrl } = await loadImageElement(blob);
    const item: ImageBatchItem = {
      id: `img-${nextId++}`,
      fileName: name,
      objectUrl,
      image,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      status: "idle",
    };
    items.value = [...items.value, item];
    if (!selectedId.value) {
      selectedId.value = item.id;
    }
    return item;
  }

  async function addFiles(files: FileList | File[]) {
    loading.value = true;
    const list = Array.from(files).filter(isImageFile);
    try {
      for (const file of list) {
        await addFromFile(file);
      }
      if (list.length === 0) {
        throw new Error("NOT_IMAGE");
      }
    } finally {
      loading.value = false;
    }
  }

  async function addPaths(paths: string[], readFile: (path: string) => Promise<Uint8Array>) {
    loading.value = true;
    const imagePaths = paths.filter(isImagePath);
    try {
      for (const path of imagePaths) {
        const bytes = await readFile(path);
        const name = path.split(/[/\\]/).pop() ?? "image.jpg";
        await addFromBlob(new Blob([new Uint8Array(bytes)]), name);
      }
    } finally {
      loading.value = false;
    }
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

  function clearAll() {
    for (const item of items.value) {
      revokeItem(item);
    }
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
      outputHeight.value = Math.max(
        1,
        Math.round((w * item.naturalHeight) / item.naturalWidth)
      );
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
      outputWidth.value = Math.max(
        1,
        Math.round((h * item.naturalWidth) / item.naturalHeight)
      );
    }
  }

  function resetOutputSize() {
    outputWidth.value = null;
    outputHeight.value = null;
  }

  function resetItemResults() {
    items.value = items.value.map((item) => ({
      ...item,
      status: "idle" as const,
      result: undefined,
    }));
  }

  return {
    items,
    loading,
    selectedId,
    selectedItem,
    outputWidth,
    outputHeight,
    lockAspect,
    jpegQuality,
    splitHeight,
    hasImages,
    doneCount,
    addFiles,
    addPaths,
    removeItem,
    clearAll,
    selectItem,
    setOutputWidth,
    setOutputHeight,
    resetOutputSize,
    resetItemResults,
    renderItemToCanvas,
    getOutputSize,
    baseNameFrom,
  };
}
