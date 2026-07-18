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
              <label class="field">
                <span class="field-label-with-tip">
                  {{ $t("font.fontName") }}
                  <a-tooltip :title="$t('font.fontNameHint')">
                    <span class="tip-icon">?</span>
                  </a-tooltip>
                </span>
                <a-input
                  v-model:value="font.fontName.value"
                  :disabled="!font.hasFont.value"
                  placeholder="font_16"
                />
              </label>

              <label class="field">
                <span class="field-label-with-tip">
                  {{ $t("font.size") }} (px)
                  <a-tooltip :title="$t('font.sizeHint')">
                    <span class="tip-icon">?</span>
                  </a-tooltip>
                </span>
                <a-input-number
                  v-model:value="font.size.value"
                  :min="4"
                  :max="256"
                  :disabled="!font.hasFont.value"
                  style="width: 100%"
                />
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

              <label class="field">
                <span class="field-label-with-tip">
                  {{ $t("font.outputFormat") }}
                  <a-tooltip :title="$t('font.outputFormatHint')">
                    <span class="tip-icon">?</span>
                  </a-tooltip>
                </span>
                <a-select
                  v-model:value="font.format.value"
                  :disabled="!font.hasFont.value"
                  style="width: 100%"
                  :options="formatOptions"
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
                </span>
                <a-textarea
                  v-model:value="font.symbols.value"
                  :disabled="!font.hasFont.value"
                  :rows="2"
                  :placeholder="$t('font.symbolsPlaceholder')"
                />
              </label>
            </div>
          </div>

          <div class="settings-block">
            <div class="block-title">{{ $t("font.advanced") }}</div>
            <div class="check-grid">
              <label class="field field--check">
                <span class="field-label-with-tip">
                  <a-checkbox
                    v-model:checked="font.compress.value"
                    :disabled="!font.hasFont.value"
                  >
                    {{ $t("font.compress") }}
                  </a-checkbox>
                  <a-tooltip :title="$t('font.compressHint')">
                    <span class="tip-icon">?</span>
                  </a-tooltip>
                </span>
              </label>

              <label class="field field--check">
                <span class="field-label-with-tip">
                  <a-checkbox
                    v-model:checked="font.lcd.value"
                    :disabled="!font.hasFont.value"
                  >
                    {{ $t("font.lcd") }}
                  </a-checkbox>
                  <a-tooltip :title="$t('font.lcdHint')">
                    <span class="tip-icon">?</span>
                  </a-tooltip>
                </span>
              </label>

              <label class="field field--check">
                <span class="field-label-with-tip">
                  <a-checkbox
                    v-model:checked="font.lcdV.value"
                    :disabled="!font.hasFont.value"
                  >
                    {{ $t("font.lcdV") }}
                  </a-checkbox>
                  <a-tooltip :title="$t('font.lcdVHint')">
                    <span class="tip-icon">?</span>
                  </a-tooltip>
                </span>
              </label>

              <label class="field field--check">
                <span class="field-label-with-tip">
                  <a-checkbox
                    v-model:checked="font.useColorInfo.value"
                    :disabled="!font.hasFont.value"
                  >
                    {{ $t("font.useColorInfo") }}
                  </a-checkbox>
                  <a-tooltip :title="$t('font.useColorInfoHint')">
                    <span class="tip-icon">?</span>
                  </a-tooltip>
                </span>
              </label>

              <label class="field field--check">
                <span class="field-label-with-tip">
                  <a-checkbox
                    v-model:checked="font.noKerning.value"
                    :disabled="!font.hasFont.value"
                  >
                    {{ $t("font.noKerning") }}
                  </a-checkbox>
                  <a-tooltip :title="$t('font.noKerningHint')">
                    <span class="tip-icon">?</span>
                  </a-tooltip>
                </span>
              </label>
            </div>

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

        <div class="action-row">
          <a-button
            type="primary"
            size="large"
            :loading="converting"
            :disabled="!font.hasFont.value"
            @click="onConvert"
          >
            {{ $t("font.convert") }}
          </a-button>
          <a-button
            size="large"
            :disabled="!font.current.value?.result?.binBytes"
            @click="downloadBin"
          >
            {{ $t("font.downloadBin") }}
          </a-button>
          <a-button
            size="large"
            :disabled="!font.current.value?.result?.cSource"
            @click="downloadC"
          >
            {{ $t("font.downloadC") }}
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
          :preview-size="Math.min(56, Math.max(18, font.size.value))"
          :empty-text="$t('font.previewEmpty')"
        />
      </section>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
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
import { convertLvglFont, RANGE_PRESETS } from "@/utils/font/lvgl";
import {
  saveBytesWithDialog,
  saveTextWithDialog,
} from "@/utils/image/shared/saveDialog";

const emit = defineEmits<{
  summary: [
    payload: {
      hasFont: boolean;
      done: boolean;
      fileName?: string;
      sourcePath?: string | null;
    },
  ];
}>();

const { t } = useI18n();
const converting = ref(false);
const font = useLvglFont();
const historyStore = useFontHistoryStore();
const { activatePath } = storeToRefs(historyStore);

const bppOptions = computed(() => [
  { value: 1, label: t("font.bpp1") },
  { value: 2, label: t("font.bpp2") },
  { value: 3, label: t("font.bpp3") },
  { value: 4, label: t("font.bpp4") },
  { value: 8, label: t("font.bpp8") },
]);

const formatOptions = computed(() => [
  { value: "both", label: t("font.formatBoth") },
  { value: "lvgl", label: t("font.formatC") },
  { value: "bin", label: t("font.formatBin") },
]);

const rangePresetOptions = computed(() =>
  RANGE_PRESETS.map((p) => ({
    value: p.key,
    label: t(`font.preset.${p.key}`),
  }))
);

watch(
  [
    () => font.hasFont.value,
    () => font.current.value?.status === "done",
    () => font.current.value?.fileName,
    () => font.current.value?.sourcePath,
  ],
  ([hasFont, done, fileName, sourcePath]) =>
    emit("summary", {
      hasFont: !!hasFont,
      done: !!done,
      fileName: typeof fileName === "string" ? fileName : undefined,
      sourcePath: typeof sourcePath === "string" ? sourcePath : null,
    }),
  { immediate: true }
);

watch(
  () => font.bpp.value,
  (bpp) => {
    if (bpp === 3 && !font.compress.value) {
      font.compress.value = true;
      message.info(t("font.bpp3AutoCompress"));
    }
  }
);

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
  if (code === "BPP3_NEEDS_COMPRESS" || code.includes("BPP3_NEEDS_COMPRESS")) {
    message.warning(t("font.bpp3NeedsCompress"));
    return;
  }
  if (code.startsWith("INVALID_RANGE:")) {
    message.warning(t("font.invalidRange", { range: code.slice(14) }));
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
          extensions: ["ttf", "otf", "woff", "woff2"],
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
  if (!item) {
    return;
  }
  converting.value = true;
  font.setStatus("converting");
  try {
    const result = await convertLvglFont(
      item.sourceBytes,
      item.fileName,
      font.currentOptions()
    );
    font.setResult(result);
    if (item.sourcePath) {
      historyStore.addPath(item.sourcePath);
    }
    message.success(t("font.convertSuccess"));
  } catch (error) {
    font.setStatus("error");
    reportConvertError(error);
  } finally {
    converting.value = false;
  }
}

async function downloadBin() {
  const result = font.current.value?.result;
  if (!result?.binBytes) {
    return;
  }
  try {
    const path = await saveBytesWithDialog(
      result.binBytes,
      `${result.fontName}.bin`,
      [{ name: "BIN", extensions: ["bin"] }]
    );
    if (path) {
      message.success(t("font.saveSuccess", { path }));
    }
  } catch {
    message.error(t("font.saveFailed"));
  }
}

async function downloadC() {
  const result = font.current.value?.result;
  if (!result?.cSource) {
    return;
  }
  try {
    const path = await saveTextWithDialog(
      result.cSource,
      `${result.fontName}.c`,
      [{ name: "C", extensions: ["c"] }]
    );
    if (path) {
      message.success(t("font.saveSuccess", { path }));
    }
  } catch {
    message.error(t("font.saveFailed"));
  }
}

useTauriDragDrop({
  onDrop(paths) {
    const fontPaths = paths.filter((path) =>
      /\.(ttf|otf|woff2?)$/i.test(path)
    );
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

onBeforeUnmount(() => {
  font.clearCurrent();
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

.check-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 14px;
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
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr;
  gap: 10px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
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

  .field-grid,
  .check-grid {
    grid-template-columns: 1fr;
  }

  .action-row {
    grid-template-columns: 1fr;
  }
}
</style>
