import { computed, ref, watch } from "vue";
import {
  DEFAULT_LVGL_FONT_OPTIONS,
  type LvglFontBpp,
  type LvglFontConvertOptions,
  type LvglFontConvertResult,
  type LvglFontFormat,
} from "@/utils/font/lvgl";
import {
  buildDisplayAutoFontName,
  normalizeFontSizes,
  parseFontSizesInput,
  resolveFontNameForSize,
} from "@/utils/font/lvgl/fontSizes";
import { readFontInternalName } from "@/utils/font/lvgl/fontInternalName";
import { sanitizeFontName } from "@/utils/font/lvgl/range";
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
  /** 多字号转换结果（按字号升序） */
  results?: LvglFontConvertResult[];
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

export function useLvglFont() {
  const current = ref<CurrentFont | null>(null);
  const loading = ref(false);

  /** 默认开启：按内建名 + 字号 + bpp 自动生成 C 符号名 */
  const autoName = ref(true);
  const fontName = ref(DEFAULT_LVGL_FONT_OPTIONS.fontName);
  /** 多字号列表（UI 可增减）；内部始终经 normalize */
  const sizes = ref<number[]>([DEFAULT_LVGL_FONT_OPTIONS.size]);
  const bpp = ref<LvglFontBpp>(DEFAULT_LVGL_FONT_OPTIONS.bpp);
  const range = ref(DEFAULT_LVGL_FONT_OPTIONS.range);
  const symbols = ref(DEFAULT_LVGL_FONT_OPTIONS.symbols);
  const fallback = ref(DEFAULT_LVGL_FONT_OPTIONS.fallback);
  const lvInclude = ref(DEFAULT_LVGL_FONT_OPTIONS.lvInclude);
  const previewText = ref("AaBbCc 0123 你好世界");

  const hasFont = computed(() => current.value != null);

  const normalizedSizes = computed(() => normalizeFontSizes(sizes.value));

  /** 预览用主字号：取列表中最大的，更接近最终观感 */
  const primarySize = computed(() => {
    const list = normalizedSizes.value;
    return list[list.length - 1] ?? DEFAULT_LVGL_FONT_OPTIONS.size;
  });

  const hasAnyC = computed(
    () => current.value?.results?.some((r) => !!r.cSource) ?? false
  );
  const hasAnyBin = computed(
    () => current.value?.results?.some((r) => !!r.binData?.byteLength) ?? false
  );

  function applyAutoName() {
    if (!autoName.value || !current.value) {
      return;
    }
    fontName.value = buildDisplayAutoFontName(
      current.value.nameSlug,
      normalizedSizes.value,
      bpp.value
    );
  }

  watch(
    sizes,
    (v) => {
      const next = normalizeFontSizes(v);
      const same =
        next.length === v.length && next.every((n, i) => n === v[i]);
      if (!same) {
        sizes.value = next;
      }
    },
    { deep: true }
  );

  watch([autoName, sizes, bpp], () => {
    applyAutoName();
  });

  /** 影响输出的参数变更后作废旧结果，避免保存过期文件 */
  watch([sizes, bpp, range, symbols, fallback, lvInclude, fontName, autoName], () => {
    if (!current.value?.results?.length) {
      return;
    }
    current.value = {
      ...current.value,
      status: "idle",
      results: undefined,
    };
  });

  function setSizesFromInput(input: unknown): {
    truncated: boolean;
    invalidCount: number;
  } {
    const parsed = parseFontSizesInput(input);
    sizes.value = parsed.sizes;
    return {
      truncated: parsed.truncated,
      invalidCount: parsed.invalidCount,
    };
  }

  function optionsForSize(size: number): LvglFontConvertOptions {
    const list = normalizedSizes.value;
    const format: LvglFontFormat = bpp.value === 8 ? "lvgl" : "both";
    const nameSlug = current.value?.nameSlug ?? "font";
    return {
      fontName: resolveFontNameForSize({
        autoName: autoName.value,
        nameSlug,
        baseFontName: fontName.value,
        size,
        bpp: bpp.value,
        sizeCount: list.length,
      }),
      size,
      bpp: bpp.value,
      format,
      range: range.value,
      symbols: symbols.value,
      fallback: fallback.value,
      lvInclude: lvInclude.value,
    };
  }

  /** @deprecated 单字号兼容；多字号请用 optionsForSize */
  function currentOptions(): LvglFontConvertOptions {
    return optionsForSize(primarySize.value);
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
        `${baseNameFrom(name)}_${primarySize.value}`
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

  function setResults(results: LvglFontConvertResult[]) {
    if (!current.value) {
      return;
    }
    current.value = {
      ...current.value,
      status: "done",
      results,
    };
  }

  return {
    current,
    loading,
    autoName,
    fontName,
    sizes,
    bpp,
    range,
    symbols,
    fallback,
    lvInclude,
    previewText,
    hasFont,
    hasAnyC,
    hasAnyBin,
    normalizedSizes,
    primarySize,
    currentOptions,
    optionsForSize,
    setSizesFromInput,
    loadFile,
    loadPath,
    clearCurrent,
    setStatus,
    setResults,
  };
}
