import { computed, ref } from "vue";
import {
  DEFAULT_WAV_TO_OGG_OPTIONS,
  type ChannelMode,
  type WavToOggResult,
} from "@/utils/audio/ogg/types";
import { decodeWav } from "@/utils/audio/ogg/wav";

type AudioItemStatus = "idle" | "converting" | "done" | "error";

interface AudioBatchItem {
  id: string;
  fileName: string;
  /** 原始 WAV 可播放 URL */
  sourceUrl: string;
  /** 源文件字节，用于转换 */
  sourceBytes: Uint8Array;
  durationSec: number;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  waveform: number[];
  status: AudioItemStatus;
  result?: WavToOggResult & { objectUrl: string };
}

let nextId = 1;

function baseNameFrom(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

function isWavFile(file: File) {
  return (
    file.type === "audio/wav" ||
    file.type === "audio/wave" ||
    file.type === "audio/x-wav" ||
    /\.wav$/i.test(file.name)
  );
}

function isWavPath(path: string) {
  return /\.wav$/i.test(path);
}

function buildWaveform(samples: Float32Array, channels: number, bars = 12): number[] {
  const frames = Math.floor(samples.length / channels);
  if (frames <= 0) {
    return Array.from({ length: bars }, () => 30);
  }
  const block = Math.max(1, Math.floor(frames / bars));
  const out: number[] = [];
  for (let b = 0; b < bars; b++) {
    let peak = 0;
    const start = b * block;
    const end = Math.min(frames, start + block);
    for (let i = start; i < end; i++) {
      let mix = 0;
      for (let c = 0; c < channels; c++) {
        mix += Math.abs(samples[i * channels + c] ?? 0);
      }
      peak = Math.max(peak, mix / channels);
    }
    out.push(Math.max(12, Math.min(100, Math.round(peak * 100))));
  }
  return out;
}

export function useWav2OggBatch() {
  const items = ref<AudioBatchItem[]>([]);
  const loading = ref(false);
  const selectedId = ref<string | null>(null);

  const sampleRate = ref<8000 | 12000 | 16000 | 24000 | 48000>(
    DEFAULT_WAV_TO_OGG_OPTIONS.sampleRate
  );
  const bitrateKbps = ref(DEFAULT_WAV_TO_OGG_OPTIONS.bitrateKbps);
  const bitDepth = ref<16 | 24 | 32>(DEFAULT_WAV_TO_OGG_OPTIONS.bitDepth);
  const durationSec = ref<number | null>(DEFAULT_WAV_TO_OGG_OPTIONS.durationSec);
  const channelMode = ref<ChannelMode>(DEFAULT_WAV_TO_OGG_OPTIONS.channelMode);
  const complexity = ref(DEFAULT_WAV_TO_OGG_OPTIONS.complexity);
  const frameDurationMs = ref<20 | 40 | 60>(60);

  const hasItems = computed(() => items.value.length > 0);
  const selectedItem = computed(
    () => items.value.find((item) => item.id === selectedId.value) ?? null
  );
  const doneCount = computed(
    () => items.value.filter((item) => item.status === "done").length
  );

  function revokeItem(item: AudioBatchItem) {
    URL.revokeObjectURL(item.sourceUrl);
    if (item.result?.objectUrl) {
      URL.revokeObjectURL(item.result.objectUrl);
    }
  }

  async function addFromBytes(bytes: Uint8Array, name: string) {
    const copy = new Uint8Array(bytes);
    const ab = copy.buffer.slice(
      copy.byteOffset,
      copy.byteOffset + copy.byteLength
    ) as ArrayBuffer;
    const decoded = decodeWav(ab);
    const frames = Math.floor(decoded.samples.length / decoded.channels);
    const sourceUrl = URL.createObjectURL(
      new Blob([new Uint8Array(copy)], { type: "audio/wav" })
    );
    const item: AudioBatchItem = {
      id: `aud-${nextId++}`,
      fileName: name,
      sourceUrl,
      sourceBytes: copy,
      durationSec: frames / decoded.sampleRate,
      sampleRate: decoded.sampleRate,
      channels: decoded.channels,
      bitsPerSample: decoded.bitsPerSample,
      waveform: buildWaveform(decoded.samples, decoded.channels),
      status: "idle",
    };
    items.value = [...items.value, item];
    if (!selectedId.value) {
      selectedId.value = item.id;
    }
    return item;
  }

  async function addFromFile(file: File) {
    if (!isWavFile(file)) {
      throw new Error("NOT_WAV");
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    return addFromBytes(buf, file.name);
  }

  async function addFiles(files: FileList | File[]) {
    loading.value = true;
    const list = Array.from(files).filter(isWavFile);
    try {
      for (const file of list) {
        await addFromFile(file);
      }
      if (list.length === 0) {
        throw new Error("NOT_WAV");
      }
    } finally {
      loading.value = false;
    }
  }

  async function addPaths(
    paths: string[],
    readFile: (path: string) => Promise<Uint8Array>
  ) {
    loading.value = true;
    const wavPaths = paths.filter(isWavPath);
    try {
      for (const path of wavPaths) {
        const bytes = await readFile(path);
        const name = path.split(/[/\\]/).pop() ?? "audio.wav";
        await addFromBytes(bytes, name);
      }
      if (wavPaths.length === 0) {
        throw new Error("NOT_WAV");
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

  function setResult(id: string, result: WavToOggResult) {
    const index = items.value.findIndex((item) => item.id === id);
    if (index < 0) {
      return;
    }
    const prev = items.value[index]!;
    if (prev.result?.objectUrl) {
      URL.revokeObjectURL(prev.result.objectUrl);
    }
    const objectUrl = URL.createObjectURL(
      new Blob([new Uint8Array(result.bytes)], { type: "audio/ogg" })
    );
    items.value[index] = {
      ...prev,
      status: "done",
      result: { ...result, objectUrl },
    };
  }

  function setStatus(id: string, status: AudioItemStatus) {
    const index = items.value.findIndex((item) => item.id === id);
    if (index < 0) {
      return;
    }
    items.value[index] = { ...items.value[index]!, status };
  }

  return {
    items,
    loading,
    selectedId,
    selectedItem,
    sampleRate,
    bitrateKbps,
    bitDepth,
    durationSec,
    channelMode,
    complexity,
    frameDurationMs,
    hasItems,
    doneCount,
    addFiles,
    addPaths,
    removeItem,
    clearAll,
    selectItem,
    setResult,
    setStatus,
    baseNameFrom,
  };
}
