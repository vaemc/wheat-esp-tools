import { computed, ref } from "vue";
import {
  DEFAULT_LVGL_FONT_OPTIONS,
  sanitizeFontName,
  type LvglFontBpp,
  type LvglFontConvertOptions,
  type LvglFontConvertResult,
  type LvglFontFormat,
} from "@/utils/font/lvgl";

export type FontStatus = "idle" | "converting" | "done" | "error";

export interface CurrentFont {
  fileName: string;
  /** 源文件绝对路径（有则写入历史） */
  sourcePath: string | null;
  objectUrl: string;
  familyName: string;
  sourceBytes: Uint8Array;
  byteLength: number;
  status: FontStatus;
  result?: LvglFontConvertResult;
}

let faceSeq = 1;

function isFontFile(file: File) {
  return (
    /\.(ttf|otf|woff2?)$/i.test(file.name) ||
    /font|truetype|opentype|woff/i.test(file.type)
  );
}

function isFontPath(path: string) {
  return /\.(ttf|otf|woff2?)$/i.test(path);
}

function guessMime(name: string): string {
  if (/\.woff2$/i.test(name)) return "font/woff2";
  if (/\.woff$/i.test(name)) return "font/woff";
  if (/\.otf$/i.test(name)) return "font/otf";
  return "font/ttf";
}

function baseNameFrom(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

export function useLvglFont() {
  const current = ref<CurrentFont | null>(null);
  const loading = ref(false);

  const fontName = ref(DEFAULT_LVGL_FONT_OPTIONS.fontName);
  const size = ref(DEFAULT_LVGL_FONT_OPTIONS.size);
  const bpp = ref<LvglFontBpp>(DEFAULT_LVGL_FONT_OPTIONS.bpp);
  const format = ref<LvglFontFormat>(DEFAULT_LVGL_FONT_OPTIONS.format);
  const range = ref(DEFAULT_LVGL_FONT_OPTIONS.range);
  const symbols = ref(DEFAULT_LVGL_FONT_OPTIONS.symbols);
  const compress = ref(DEFAULT_LVGL_FONT_OPTIONS.compress);
  const lcd = ref(DEFAULT_LVGL_FONT_OPTIONS.lcd);
  const lcdV = ref(DEFAULT_LVGL_FONT_OPTIONS.lcdV);
  const useColorInfo = ref(DEFAULT_LVGL_FONT_OPTIONS.useColorInfo);
  const noKerning = ref(DEFAULT_LVGL_FONT_OPTIONS.noKerning);
  const fallback = ref(DEFAULT_LVGL_FONT_OPTIONS.fallback);
  const lvInclude = ref(DEFAULT_LVGL_FONT_OPTIONS.lvInclude);
  const previewText = ref("AaBbCc 0123 你好世界");

  const hasFont = computed(() => current.value != null);

  function currentOptions(): LvglFontConvertOptions {
    return {
      fontName: sanitizeFontName(fontName.value),
      size: size.value,
      bpp: bpp.value,
      format: format.value,
      range: range.value,
      symbols: symbols.value,
      compress: compress.value,
      lcd: lcd.value,
      lcdV: lcdV.value,
      useColorInfo: useColorInfo.value,
      noKerning: noKerning.value,
      fallback: fallback.value,
      lvInclude: lvInclude.value,
    };
  }

  function clearCurrent() {
    if (current.value?.objectUrl) {
      URL.revokeObjectURL(current.value.objectUrl);
    }
    current.value = null;
  }

  async function loadFromBytes(
    bytes: Uint8Array,
    name: string,
    sourcePath: string | null = null
  ) {
    const copy = new Uint8Array(bytes);
    const familyName = `preview-font-${faceSeq++}`;
    const objectUrl = URL.createObjectURL(
      new Blob([copy], { type: guessMime(name) })
    );

    try {
      const face = new FontFace(familyName, `url(${objectUrl})`);
      await face.load();
      (document.fonts as FontFaceSet & { add(font: FontFace): void }).add(face);
    } catch {
      URL.revokeObjectURL(objectUrl);
      throw new Error("FONT_LOAD_FAILED");
    }

    clearCurrent();
    current.value = {
      fileName: name,
      sourcePath,
      objectUrl,
      familyName,
      sourceBytes: copy,
      byteLength: copy.byteLength,
      status: "idle",
    };

    fontName.value = sanitizeFontName(`${baseNameFrom(name)}_${size.value}`);
  }

  async function loadFile(file: File) {
    if (!isFontFile(file)) {
      throw new Error("NOT_FONT");
    }
    loading.value = true;
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      await loadFromBytes(buf, file.name, null);
    } finally {
      loading.value = false;
    }
  }

  async function loadPath(
    path: string,
    readFile: (path: string) => Promise<Uint8Array | ArrayBuffer>
  ) {
    if (!isFontPath(path)) {
      throw new Error("NOT_FONT");
    }
    loading.value = true;
    try {
      const data = await readFile(path);
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      const name = path.split(/[/\\]/).pop() ?? "font.ttf";
      await loadFromBytes(bytes, name, path);
    } finally {
      loading.value = false;
    }
  }

  function setStatus(status: FontStatus) {
    if (!current.value) {
      return;
    }
    current.value = { ...current.value, status };
  }

  function setResult(result: LvglFontConvertResult) {
    if (!current.value) {
      return;
    }
    current.value = {
      ...current.value,
      status: "done",
      result,
    };
  }

  return {
    current,
    loading,
    fontName,
    size,
    bpp,
    format,
    range,
    symbols,
    compress,
    lcd,
    lcdV,
    useColorInfo,
    noKerning,
    fallback,
    lvInclude,
    previewText,
    hasFont,
    currentOptions,
    loadFile,
    loadPath,
    clearCurrent,
    setStatus,
    setResult,
  };
}
