<template>
  <div class="workbench">
    <FontSourceCard
      class="source-bar"
      :font="font.current.value"
      @pick="pickFile"
      @clear="onClear"
      @drop-files="onDropFiles"
    />

    <section class="main-grid">
      <aside class="font-settings panel">
        <header class="panel-head panel-head--row">
          <span class="panel-title">{{ $t("font.settings") }}</span>
          <p class="panel-sub">{{ $t("font.lvglOptionsHint") }}</p>
        </header>

        <div class="settings-scroll">
          <div class="settings-block">
            <div class="block-title">{{ $t("font.lvglOptions") }}</div>
            <div class="field-grid">
              <label class="field field--span2">
                <span class="field-label-with-tip">
                  {{ $t("font.fontName") }}
                  <a-tooltip :title="$t('font.fontNameHint')">
                    <span class="tip-icon">?</span>
                  </a-tooltip>
                </span>
                <div class="font-name-row">
                  <a-input
                    v-model:value="font.fontName.value"
                    :disabled="!font.hasFont.value || font.autoName.value"
                    placeholder="font_arial_16_4"
                  />
                  <a-checkbox
                    v-model:checked="font.autoName.value"
                    :disabled="!font.hasFont.value"
                  >
                    {{ $t("font.autoName") }}
                  </a-checkbox>
                </div>
                <p v-if="font.autoName.value && font.current.value" class="field-hint">
                  {{
                    $t("font.autoNameHint", {
                      name: font.current.value.internalName,
                    })
                  }}
                </p>
              </label>

              <label class="field field--span2">
                <span class="field-label-with-tip">
                  {{ $t("font.size") }} (px)
                  <a-tooltip :title="$t('font.sizeHint')">
                    <span class="tip-icon">?</span>
                  </a-tooltip>
                  <span
                    v-if="font.normalizedSizes.value.length > 1"
                    class="symbols-count"
                  >
                    {{
                      $t("font.sizesCount", {
                        n: font.normalizedSizes.value.length,
                      })
                    }}
                  </span>
                </span>
                <a-select
                  :value="sizeTags"
                  mode="tags"
                  :token-separators="[',', ' ', ';', '；', '，', '、']"
                  :disabled="!font.hasFont.value || converting"
                  style="width: 100%"
                  :placeholder="$t('font.sizesPlaceholder')"
                  @change="onSizesChange"
                />
                <p class="field-hint">{{ $t("font.sizesHint") }}</p>
              </label>

              <label class="field">
                <span class="field-label-with-tip">
                  {{ $t("font.bpp") }}
                  <a-tooltip>
                    <template #title>
                      <div>{{ $t("font.bppHint") }}</div>
                      <div>{{ $t("font.bppHintMore") }}</div>
                    </template>
                    <span class="tip-icon">?</span>
                  </a-tooltip>
                </span>
                <a-select
                  v-model:value="font.bpp.value"
                  :disabled="!font.hasFont.value"
                  style="width: 100%"
                  :options="bppOptions"
                />
              </label>

              <label class="field field--span2">
                <span class="field-label-with-tip">
                  {{ $t("font.fallback") }}
                  <a-tooltip :title="$t('font.fallbackHint')">
                    <span class="tip-icon">?</span>
                  </a-tooltip>
                </span>
                <a-input
                  v-model:value="font.fallback.value"
                  :disabled="!font.hasFont.value"
                  :placeholder="$t('font.fallbackPlaceholder')"
                />
              </label>
            </div>
          </div>

          <div class="settings-block">
            <div class="block-title">{{ $t("font.glyphSelect") }}</div>
            <p class="block-hint">{{ $t("font.glyphSelectHint") }}</p>
            <div class="field-grid">
              <label class="field field--span2">
                <span class="field-label-with-tip">
                  {{ $t("font.range") }}
                  <a-tooltip>
                    <template #title>
                      <div>{{ $t("font.rangeHint") }}</div>
                      <div>{{ $t("font.rangeHintMore") }}</div>
                    </template>
                    <span class="tip-icon">?</span>
                  </a-tooltip>
                </span>
                <a-textarea
                  v-model:value="font.range.value"
                  :disabled="!font.hasFont.value"
                  :rows="3"
                  :placeholder="$t('font.rangePlaceholder')"
                />
              </label>

              <label class="field">
                <span>{{ $t("font.rangePreset") }}</span>
                <a-select
                  :value="undefined"
                  :disabled="!font.hasFont.value"
                  style="width: 100%"
                  :placeholder="$t('font.rangePresetPlaceholder')"
                  :options="rangePresetOptions"
                  @change="onRangePreset"
                />
              </label>

              <label class="field">
                <span class="field-label-with-tip">
                  {{ $t("font.previewText") }}
                  <a-tooltip :title="$t('font.previewTextHint')">
                    <span class="tip-icon">?</span>
                  </a-tooltip>
                </span>
                <a-input
                  v-model:value="font.previewText.value"
                  :disabled="!font.hasFont.value"
                  :placeholder="$t('font.previewTextPlaceholder')"
                />
              </label>

              <label class="field field--span2">
                <span class="field-label-with-tip">
                  {{ $t("font.symbols") }}
                  <a-tooltip :title="$t('font.symbolsHint')">
                    <span class="tip-icon">?</span>
                  </a-tooltip>
                  <span v-if="symbolsCount > 0" class="symbols-count">
                    {{ $t("font.symbolsCount", { n: symbolsCount }) }}
                  </span>
                </span>
                <div class="symbols-actions">
                  <a-button
                    size="small"
                    :loading="extractingChars"
                    @click="importSymbolsFromC"
                  >
                    {{ $t("font.importFromLvglC") }}
                  </a-button>
                  <a-button
                    size="small"
                    :disabled="!font.symbols.value"
                    @click="clearSymbols"
                  >
                    {{ $t("font.clearSymbols") }}
                  </a-button>
                </div>
                <a-textarea
                  v-model:value="font.symbols.value"
                  :disabled="!font.hasFont.value && !font.symbols.value"
                  :rows="4"
                  :placeholder="$t('font.symbolsPlaceholder')"
                />
                <p class="field-hint">{{ $t("font.importFromLvglCHint") }}</p>
              </label>
            </div>
          </div>

          <div class="settings-block">
            <div class="block-title">{{ $t("font.advanced") }}</div>
            <p class="block-hint">{{ $t("font.advancedFastHint") }}</p>
            <label class="field field--mt">
              <span class="field-label-with-tip">
                {{ $t("font.lvInclude") }}
                <a-tooltip :title="$t('font.lvIncludeHint')">
                  <span class="tip-icon">?</span>
                </a-tooltip>
              </span>
              <a-input
                v-model:value="font.lvInclude.value"
                :disabled="!font.hasFont.value"
                placeholder="lvgl.h"
              />
            </label>
          </div>
        </div>

        <div v-if="converting" class="convert-progress">
          <div class="convert-progress-meta">
            <span>{{ progressMessage || $t("font.converting") }}</span>
            <span>{{ Math.round(progressPercent) }}%</span>
          </div>
          <a-progress
            :percent="Math.round(progressPercent)"
            :show-info="false"
            size="small"
            status="active"
          />
        </div>

        <div class="action-row">
          <a-button
            type="primary"
            size="large"
            :loading="converting"
            :disabled="!font.hasFont.value || converting"
            @click="onConvert"
          >
            {{ $t("font.convert") }}
          </a-button>
          <a-button
            size="large"
            :disabled="!font.hasAnyC.value"
            @click="downloadC"
          >
            {{ downloadCLabel }}
          </a-button>
          <a-button
            size="large"
            :disabled="!font.hasAnyBin.value"
            @click="downloadBin"
          >
            {{ downloadBinLabel }}
          </a-button>
        </div>
      </aside>

      <section class="preview-panel panel">
        <header class="panel-head">
          <span class="panel-title">{{ $t("font.ttfPreview") }}</span>
        </header>
        <FontPreview
          :family-name="font.current.value?.familyName ?? null"
          :file-name="font.current.value?.fileName"
          :byte-length="font.current.value?.byteLength"
          :sample-text="font.previewText.value"
          :preview-size="Math.min(56, Math.max(18, font.primarySize.value))"
          :empty-text="$t('font.previewEmpty')"
        />
      </section>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import FontSourceCard from "../../shared/components/FontSourceCard.vue";
import FontPreview from "./components/FontPreview.vue";
import { useLvglFont } from "./composables/useLvglFont";
import { useTauriDragDrop } from "@/composables/useTauriDragDrop";
import { useFontHistoryStore } from "@/stores/fontHistory";
import {
  convertLvglFont,
  extractLvglFontChars,
  LVGL_FONT_SIZES_MAX_COUNT,
  onLvglFontProgress,
  RANGE_PRESETS,
} from "@/utils/font/lvgl";
import {
  saveBytesWithDialog,
  saveFilesToPickedDir,
  saveTextWithDialog,
} from "@/utils/image/shared/saveDialog";

const { t } = useI18n();
const converting = ref(false);
const extractingChars = ref(false);
const progressPercent = ref(0);
const progressMessage = ref("");
/** 当前批量任务前缀，用于过滤进度事件；子任务为 `${prefix}-${size}` */
const activeJobPrefix = ref<string | null>(null);
const activeSizeIndex = ref(0);
const activeSizeTotal = ref(1);
let unlistenProgress: (() => void) | null = null;
const font = useLvglFont();
const historyStore = useFontHistoryStore();
const { activatePath } = storeToRefs(historyStore);

const sizeTags = computed(() =>
  font.normalizedSizes.value.map((n) => String(n))
);

/** 已有多结果，或尚未转换但已设多字号 → 按批量保存文案提示 */
const isMultiExport = computed(() => {
  const n = font.current.value?.results?.length ?? 0;
  if (n > 0) {
    return n > 1;
  }
  return font.normalizedSizes.value.length > 1;
});

const downloadCLabel = computed(() =>
  isMultiExport.value ? t("font.downloadAllC") : t("font.downloadC")
);
const downloadBinLabel = computed(() =>
  isMultiExport.value ? t("font.downloadAllBin") : t("font.downloadBin")
);

const symbolsCount = computed(() => {
  const s = font.symbols.value ?? "";
  return s.length ? [...s].length : 0;
});

function onSizesChange(value: unknown) {
  const { truncated, invalidCount } = font.setSizesFromInput(value);
  if (invalidCount > 0) {
    message.warning(t("font.sizesInvalid"));
  }
  if (truncated) {
    message.warning(
      t("font.sizesTruncated", { max: LVGL_FONT_SIZES_MAX_COUNT })
    );
  }
}

const bppOptions = computed(() => [
  { value: 1, label: t("font.bpp1") },
  { value: 2, label: t("font.bpp2") },
  { value: 4, label: t("font.bpp4") },
  { value: 8, label: t("font.bpp8") },
]);

const rangePresetOptions = computed(() =>
  RANGE_PRESETS.map((p) => ({
    value: p.key,
    label: t(`font.preset.${p.key}`),
  }))
);

onMounted(async () => {
  unlistenProgress = await onLvglFontProgress((payload) => {
    const prefix = activeJobPrefix.value;
    if (!prefix || !payload.jobId.startsWith(`${prefix}-`)) {
      return;
    }
    const total = Math.max(1, activeSizeTotal.value);
    const index = Math.min(
      Math.max(0, activeSizeIndex.value),
      total - 1
    );
    const stageRatio = Math.min(100, Math.max(0, payload.percent)) / 100;
    progressPercent.value = ((index + stageRatio) / total) * 100;
    const sizeLabel = payload.jobId.slice(prefix.length + 1);
    const stageMsg = formatProgressMessage(payload);
    progressMessage.value =
      total > 1
        ? t("font.progress.multiSize", {
            index: index + 1,
            total,
            size: sizeLabel,
            message: stageMsg,
          })
        : stageMsg;
  });
});

onBeforeUnmount(() => {
  unlistenProgress?.();
  unlistenProgress = null;
  activeJobPrefix.value = null;
  font.clearCurrent();
});

function formatProgressMessage(payload: {
  stage: string;
  current: number;
  total: number;
  message: string;
}) {
  switch (payload.stage) {
    case "load":
      return t("font.progress.load");
    case "cmap":
      return t("font.progress.cmap", { n: payload.current || payload.total });
    case "render":
      return t("font.progress.render", {
        current: payload.current,
        total: payload.total,
      });
    case "write":
      return t("font.progress.write", {
        current: payload.current,
        total: payload.total,
      });
    case "done":
      return t("font.progress.done");
    default:
      return payload.message || t("font.converting");
  }
}

watch(activatePath, (path) => {
  if (!path) {
    return;
  }
  void (async () => {
    try {
      await font.loadPath(path, readFile);
      historyStore.addPath(path);
      message.success(
        t("font.loadSuccess", { name: font.current.value?.fileName })
      );
    } catch (error) {
      reportLoadError(error, "activate history failed");
      if (error instanceof Error && error.message !== "NOT_FONT") {
        message.warning(t("font.historyMissing"));
      }
    } finally {
      historyStore.clearActivate();
    }
  })();
});

function onRangePreset(key: unknown) {
  if (typeof key !== "string") {
    return;
  }
  const preset = RANGE_PRESETS.find((p) => p.key === key);
  if (preset) {
    font.range.value = preset.range;
  }
}

function clearSymbols() {
  font.symbols.value = "";
}

async function importSymbolsFromC() {
  if (extractingChars.value) {
    return;
  }
  try {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "LVGL Font C",
          extensions: ["c"],
        },
      ],
    });
    if (selected == null || Array.isArray(selected)) {
      return;
    }
    extractingChars.value = true;
    const result = await extractLvglFontChars({ path: selected });
    font.symbols.value = result.characters;
    message.success(
      t("font.importFromLvglCSuccess", {
        name: result.sourceName,
        n: result.count,
      })
    );
  } catch (error) {
    console.error("[font/lvglfont] extract chars failed:", error);
    const msg = error instanceof Error ? error.message : String(error);
    message.error(msg || t("font.importFromLvglCFailed"));
  } finally {
    extractingChars.value = false;
  }
}

function reportLoadError(error: unknown, where: string) {
  console.error(`[font/lvglfont] ${where}:`, error);
  const code = error instanceof Error ? error.message : "";
  if (code === "NOT_FONT") {
    message.warning(t("font.notFont"));
    return;
  }
  if (code === "FONT_LOAD_FAILED") {
    message.error(t("font.fontLoadFailed"));
    return;
  }
  message.error(
    error instanceof Error && error.message
      ? `${t("font.loadFailed")}: ${error.message}`
      : t("font.loadFailed")
  );
}

function reportConvertError(error: unknown) {
  console.error("[font/lvglfont] convert failed:", error);
  const code = error instanceof Error ? error.message : String(error);
  if (code === "EMPTY_GLYPHS" || code.includes("EMPTY_GLYPHS")) {
    message.warning(t("font.emptyGlyphs"));
    return;
  }
  if (code === "TOO_MANY_GLYPHS" || code.includes("TOO_MANY_GLYPHS")) {
    message.warning(t("font.tooManyGlyphs"));
    return;
  }
  if (code === "RANGE_TOO_WIDE" || code.includes("RANGE_TOO_WIDE")) {
    message.warning(t("font.rangeTooWide"));
    return;
  }
  if (
    code === "BPP8_BIN_UNSUPPORTED" ||
    code.includes("BPP8_BIN_UNSUPPORTED")
  ) {
    message.warning(t("font.bpp8BinUnsupported"));
    return;
  }
  if (code.startsWith("INVALID_RANGE:") || code.includes("INVALID_RANGE:")) {
    const idx = code.indexOf("INVALID_RANGE:");
    const range = code.slice(idx + "INVALID_RANGE:".length);
    message.warning(t("font.invalidRange", { range }));
    return;
  }
  const msg = error instanceof Error ? error.message : String(error);
  message.error(msg || t("font.convertFailed"));
}

async function pickFile() {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Font",
          extensions: ["ttf", "otf"],
        },
      ],
    });
    if (selected == null || Array.isArray(selected)) {
      return;
    }
    await loadFromPath(selected);
  } catch (error) {
    reportLoadError(error, "pick file failed");
  }
}

async function onDropFiles(files: FileList | File[]) {
  const list = Array.from(files);
  const first = list[0];
  if (!first) {
    return;
  }
  if (list.length > 1) {
    message.info(t("font.singleOnly"));
  }
  try {
    await font.loadFile(first);
  } catch (error) {
    reportLoadError(error, "drop file failed");
  }
}

async function loadFromPath(path: string) {
  try {
    await font.loadPath(path, readFile);
    historyStore.addPath(path);
    message.success(
      t("font.loadSuccess", { name: font.current.value?.fileName })
    );
  } catch (error) {
    reportLoadError(error, "load path failed");
  }
}

function onClear() {
  font.clearCurrent();
}

async function onConvert() {
  const item = font.current.value;
  if (!item || converting.value) {
    return;
  }
  const sizeList = font.normalizedSizes.value;
  if (!sizeList.length) {
    message.warning(t("font.sizesEmpty"));
    return;
  }

  converting.value = true;
  progressPercent.value = 0;
  progressMessage.value = t("font.converting");
  font.setStatus("converting");
  const jobPrefix = `lvgl-font-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  activeJobPrefix.value = jobPrefix;
  activeSizeTotal.value = sizeList.length;
  activeSizeIndex.value = 0;

  const results: Awaited<ReturnType<typeof convertLvglFont>>[] = [];
  let failedSize: number | null = null;
  let lastError: unknown = null;

  try {
    for (let i = 0; i < sizeList.length; i++) {
      const size = sizeList[i]!;
      activeSizeIndex.value = i;
      progressMessage.value =
        sizeList.length > 1
          ? t("font.progress.multiSize", {
              index: i + 1,
              total: sizeList.length,
              size,
              message: t("font.converting"),
            })
          : t("font.converting");
      try {
        const result = await convertLvglFont({
          fontBytes: item.sourceBytes,
          fontFileName: item.fileName,
          fontPath: item.sourcePath,
          options: font.optionsForSize(size),
          jobId: `${jobPrefix}-${size}`,
        });
        results.push(result);
      } catch (error) {
        failedSize = size;
        lastError = error;
        break;
      }
    }

    if (results.length) {
      font.setResults(results);
      if (item.sourcePath) {
        historyStore.addPath(item.sourcePath);
      }
    }

    if (failedSize != null) {
      if (!results.length) {
        font.setStatus("error");
      }
      reportConvertError(lastError);
      if (results.length) {
        message.warning(
          t("font.convertPartial", {
            ok: results.length,
            total: sizeList.length,
            size: failedSize,
          })
        );
      }
      return;
    }

    const totalGlyphs = results.reduce((n, r) => n + (r.glyphCount ?? 0), 0);
    const totalMs = results.reduce((n, r) => n + (r.elapsedMs ?? 0), 0);
    const elapsed =
      totalMs > 0
        ? ` (${(totalMs / 1000).toFixed(1)}s, ${totalGlyphs} glyphs, ${results.length} size${results.length > 1 ? "s" : ""})`
        : "";
    message.success(`${t("font.convertSuccess")}${elapsed}`);
  } finally {
    converting.value = false;
    activeJobPrefix.value = null;
    activeSizeIndex.value = 0;
    activeSizeTotal.value = 1;
    progressPercent.value = 0;
    progressMessage.value = "";
  }
}

function uniqueFileName(
  name: string,
  used: Set<string>
): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let i = 2;
  let candidate = `${stem}_${i}${ext}`;
  while (used.has(candidate)) {
    i += 1;
    candidate = `${stem}_${i}${ext}`;
  }
  used.add(candidate);
  return candidate;
}

async function downloadC() {
  const results = font.current.value?.results?.filter((r) => r.cSource) ?? [];
  if (!results.length) {
    return;
  }
  const encoder = new TextEncoder();
  try {
    if (results.length === 1) {
      const result = results[0]!;
      const path = await saveTextWithDialog(
        result.cSource!,
        `${result.fontName}.c`,
        [{ name: "C", extensions: ["c"] }]
      );
      if (path) {
        message.success(t("font.saveSuccess", { path }));
      }
      return;
    }
    const used = new Set<string>();
    const files = results.map((r) => ({
      name: uniqueFileName(`${r.fontName}.c`, used),
      data: encoder.encode(r.cSource!),
    }));
    const dir = await saveFilesToPickedDir(files);
    if (dir) {
      message.success(
        t("font.saveAllSuccess", { n: files.length, path: dir })
      );
    }
  } catch {
    message.error(t("font.saveFailed"));
  }
}

async function downloadBin() {
  const results =
    font.current.value?.results?.filter((r) => r.binData?.byteLength) ?? [];
  if (!results.length) {
    return;
  }
  try {
    if (results.length === 1) {
      const result = results[0]!;
      const path = await saveBytesWithDialog(
        result.binData!,
        `${result.fontName}.bin`,
        [{ name: "LVGL Font Bin", extensions: ["bin"] }]
      );
      if (path) {
        message.success(t("font.saveSuccess", { path }));
      }
      return;
    }
    const used = new Set<string>();
    const files = results.map((r) => ({
      name: uniqueFileName(`${r.fontName}.bin`, used),
      data: r.binData!,
    }));
    const dir = await saveFilesToPickedDir(files);
    if (dir) {
      message.success(
        t("font.saveAllSuccess", { n: files.length, path: dir })
      );
    }
  } catch {
    message.error(t("font.saveFailed"));
  }
}

useTauriDragDrop({
  onDrop(paths) {
    const fontPaths = paths.filter((path) => /\.(ttf|otf)$/i.test(path));
    if (!fontPaths.length) {
      message.warning(t("font.notFont"));
      return;
    }
    if (fontPaths.length > 1) {
      message.info(t("font.singleOnly"));
    }
    void loadFromPath(fontPaths[0]!);
  },
});
</script>

<style scoped>
.workbench {
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.panel {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 14px 16px;
  min-height: 0;
}

.panel-head {
  margin-bottom: 12px;
}

.panel-head--row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.panel-title {
  font-size: 15px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.panel-sub {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1.45;
}

.source-bar {
  flex: 0 0 auto;
}

.main-grid {
  flex: 1 1 0;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
  gap: 12px;
  overflow: hidden;
}

.font-settings {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.settings-scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-right: 4px;
}

.settings-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.settings-block:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.block-title {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.72);
}

.block-hint {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.38);
  line-height: 1.5;
}

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 14px;
}

.field-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.38);
  line-height: 1.4;
}

.font-name-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.font-name-row :deep(.ant-input) {
  flex: 1;
  min-width: 0;
}

.font-name-row :deep(.ant-checkbox-wrapper) {
  flex-shrink: 0;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.72);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  min-width: 0;
}

.field--span2 {
  grid-column: 1 / -1;
}

.field--check {
  gap: 0;
}

.field--mt {
  margin-top: 4px;
}

.field-label-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.symbols-count {
  margin-left: auto;
  font-size: 12px;
  color: #faad14;
  font-variant-numeric: tabular-nums;
}

.symbols-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tip-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.28);
  font-size: 10px;
  line-height: 1;
  color: rgba(255, 255, 255, 0.55);
  cursor: help;
  flex-shrink: 0;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.action-row > :first-child {
  flex: 1.6 1 140px;
}

.action-row > :not(:first-child) {
  flex: 1 1 100px;
}

.convert-progress {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.convert-progress-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

.convert-progress-meta span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-panel {
  display: flex;
  flex-direction: column;
  overflow: auto;
}

@media (max-width: 1100px) {
  .main-grid {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) auto;
  }

  .preview-panel {
    max-height: 220px;
  }

  .field-grid {
    grid-template-columns: 1fr;
  }

  .action-row > * {
    flex: 1 1 100%;
  }
}
</style>
