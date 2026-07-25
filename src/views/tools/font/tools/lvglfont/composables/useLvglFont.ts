import { computed, ref, watch } from "vue";
import {
  DEFAULT_LVGL_FONT_OPTIONS,
  LVGL_FONT_SIZE_MAX,
  LVGL_FONT_SIZE_MIN,
  sanitizeFontName,
  type LvglFontBpp,
  type LvglFontConvertOptions,
  type LvglFontConvertResult,
} from "@/utils/font/lvgl";
import { buildAutoLvglFontName } from "@/utils/font/lvgl/autoFontName";
import { readFontInternalName } from "@/utils/font/lvgl/fontInternalName";
import { toIdentPinyin } from "@/utils/font/lvgl/toIdentPinyin";

export type FontStatus = "idle" | "converting" | "done" | "error";

export interface CurrentFont {
  fileName: string;
  /** 源文件绝对路径（有则写入历史） */
  sourcePath: string | null;
  objectUrl: string;
  familyName: string;
  fontFace: FontFace;
  /** 字体文件内建名称（name 表）；失败时回退文件名 */
  internalName: string;
  /** 内建名转成的 ASCII slug（中文已转拼音） */
  nameSlug: string;
  sourceBytes: Uint8Array;
  byteLength: number;
  status: FontStatus;
  result?: LvglFontConvertResult;
}

let faceSeq = 1;

/** DOM lib 对 FontFaceSet 的 add/delete 类型不完整，运行时存在 */
type FontFaceSetMut = FontFaceSet & {
  add(font: FontFace): void;
  delete(font: FontFace): boolean;
};

function fontFaceSet(): FontFaceSetMut {
  return document.fonts as FontFaceSetMut;
}

function isFontFile(file: File) {
  return (
    /\.(ttf|otf)$/i.test(file.name) ||
    /font|truetype|opentype/i.test(file.type)
  );
}

function isFontPath(path: string) {
  return /\.(ttf|otf)$/i.test(path);
}

function guessMime(name: string): string {
  if (/\.otf$/i.test(name)) return "font/otf";
  return "font/ttf";
}

function baseNameFrom(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

function clampSize(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return DEFAULT_LVGL_FONT_OPTIONS.size;
  }
  return Math.min(
    LVGL_FONT_SIZE_MAX,
    Math.max(LVGL_FONT_SIZE_MIN, Math.round(n))
  );
}

export function useLvglFont() {
  const current = ref<CurrentFont | null>(null);
  const loading = ref(false);

  /** 默认开启：按内建名 + 字号 + bpp 自动生成 C 符号名 */
  const autoName = ref(true);
  const fontName = ref(DEFAULT_LVGL_FONT_OPTIONS.fontName);
  const size = ref(DEFAULT_LVGL_FONT_OPTIONS.size);
  const bpp = ref<LvglFontBpp>(DEFAULT_LVGL_FONT_OPTIONS.bpp);
  const range = ref(DEFAULT_LVGL_FONT_OPTIONS.range);
  const symbols = ref(DEFAULT_LVGL_FONT_OPTIONS.symbols);
  const fallback = ref(DEFAULT_LVGL_FONT_OPTIONS.fallback);
  const lvInclude = ref(DEFAULT_LVGL_FONT_OPTIONS.lvInclude);
  const previewText = ref("AaBbCc 0123 你好世界");

  const hasFont = computed(() => current.value != null);

  function applyAutoName() {
    if (!autoName.value || !current.value) {
      return;
    }
    fontName.value = buildAutoLvglFontName(
      current.value.nameSlug,
      size.value,
      bpp.value
    );
  }

  watch(size, (v) => {
    const next = clampSize(v);
    if (v !== next) {
      size.value = next;
    }
  });

  watch([autoName, size, bpp], () => {
    applyAutoName();
  });

  function currentOptions(): LvglFontConvertOptions {
    return {
      fontName: sanitizeFontName(fontName.value),
      size: clampSize(size.value),
      bpp: bpp.value,
      format: "lvgl",
      range: range.value,
      symbols: symbols.value,
      fallback: fallback.value,
      lvInclude: lvInclude.value,
    };
  }

  function clearCurrent() {
    const prev = current.value;
    if (prev) {
      try {
        fontFaceSet().delete(prev.fontFace);
      } catch {
        // ignore
      }
      URL.revokeObjectURL(prev.objectUrl);
    }
    current.value = null;
  }

  async function loadFromBytes(
    bytes: Uint8Array,
    name: string,
    sourcePath: string | null = null
  ) {
    if (bytes.byteLength === 0) {
      throw new Error("FONT_LOAD_FAILED");
    }
    const copy = new Uint8Array(bytes);
    const familyName = `preview-font-${faceSeq++}`;
    const objectUrl = URL.createObjectURL(
      new Blob([copy], { type: guessMime(name) })
    );

    let face: FontFace;
    try {
      face = new FontFace(familyName, `url(${objectUrl})`);
      await face.load();
      fontFaceSet().add(face);
    } catch {
      URL.revokeObjectURL(objectUrl);
      throw new Error("FONT_LOAD_FAILED");
    }

    const internalName =
      readFontInternalName(copy) || baseNameFrom(name) || "font";
    const nameSlug = await toIdentPinyin(internalName);

    clearCurrent();
    current.value = {
      fileName: name,
      sourcePath,
      objectUrl,
      familyName,
      fontFace: face,
      internalName,
      nameSlug,
      sourceBytes: copy,
      byteLength: copy.byteLength,
      status: "idle",
    };

    if (autoName.value) {
      applyAutoName();
    } else {
      fontName.value = sanitizeFontName(
        `${baseNameFrom(name)}_${clampSize(size.value)}`
      );
    }
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
    autoName,
    fontName,
    size,
    bpp,
    range,
    symbols,
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
