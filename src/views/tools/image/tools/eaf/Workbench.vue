<template>
  <div class="workbench">
    <section class="image-workspace">
      <div class="workspace-main">
        <ImageBatchGrid
          :items="eaf.items.value"
          :selected-id="eaf.selectedId.value"
          :drop-title="$t('image.dropTitleGif')"
          :drop-hint="$t('image.dropHintGif')"
          @pick="pickGifs"
          @drop-files="onHtmlDrop"
          @select="onSelectItem"
          @remove="eaf.removeItem"
          @clear-all="onClearAll"
        />
      </div>

      <div class="workspace-preview panel">
        <header class="panel-head panel-head--row">
          <span class="panel-title">{{ $t("image.preview") }}</span>
          <a-button size="small" @click="pickExternalEaf">
            {{ $t("image.openEafPreview") }}
          </a-button>
        </header>
        <EafPreview
          :frames="previewFrames"
          :width="previewMeta.width"
          :height="previewMeta.height"
          :bit-depth="previewMeta.bitDepth"
          :empty-text="$t('image.previewEmpty')"
          :play-label="$t('image.previewPlay')"
          :pause-label="$t('image.previewPause')"
          :loop-label="$t('image.previewLoop')"
          :frames-label="$t('image.previewFrames')"
          :loading="previewLoading"
          :loading-text="$t('image.previewDecoding')"
          :progress-text="previewProgressText"
          :expected-frame-count="previewExpectedFrames"
        />
      </div>
    </section>

    <aside class="image-settings panel">
      <header class="panel-head">
        <span class="panel-title">{{ $t("image.settings") }}</span>
      </header>

      <div v-if="selectedPreview" class="selected-preview">
        <img :src="selectedPreview.url" :alt="selectedPreview.name" />
        <div class="selected-meta">
          <div class="selected-name" :title="selectedPreview.name">
            {{ selectedPreview.name }}
          </div>
          <div class="selected-size">
            {{ selectedPreview.width }} × {{ selectedPreview.height }}
          </div>
        </div>
      </div>

      <div class="settings-block">
        <div class="block-title">{{ $t("image.resize") }}</div>
        <p class="block-hint">{{ $t("image.resizeEafHint") }}</p>
        <div class="field-row">
          <label class="field">
            <span>{{ $t("image.width") }}</span>
            <a-input-number
              :value="eaf.outputWidth.value"
              :min="1"
              :max="4096"
              :disabled="!eaf.hasItems.value"
              :placeholder="$t('image.original')"
              @update:value="onWidthChange"
            />
          </label>
          <label class="field">
            <span>{{ $t("image.height") }}</span>
            <a-input-number
              :value="eaf.outputHeight.value"
              :min="1"
              :max="4096"
              :disabled="!eaf.hasItems.value"
              :placeholder="$t('image.original')"
              @update:value="onHeightChange"
            />
          </label>
        </div>
        <div class="field-inline">
          <a-checkbox
            v-model:checked="eaf.lockAspect.value"
            :disabled="!eaf.hasItems.value"
          >
            {{ $t("image.lockAspect") }}
          </a-checkbox>
          <a-button
            size="small"
            type="link"
            :disabled="!eaf.hasItems.value"
            @click="eaf.resetOutputSize"
          >
            {{ $t("image.useOriginal") }}
          </a-button>
        </div>
      </div>

      <div class="settings-block">
        <div class="block-title">{{ $t("image.eafOptions") }}</div>

        <label class="field field--full">
          <span class="field-label-with-tip">
            {{ $t("image.encodingMode") }}
            <a-tooltip :title="$t('image.encodingModeHint')">
              <span class="tip-icon">?</span>
            </a-tooltip>
          </span>
          <a-select
            :value="eaf.encodingMode.value"
            :options="encodingOptions"
            :disabled="!eaf.hasItems.value"
            style="width: 100%"
            @update:value="eaf.setEncodingMode"
          />
        </label>

        <label class="field field--full">
          <span class="field-label-with-tip">
            {{ $t("image.colorDepth") }}
            <a-tooltip :title="$t('image.colorDepthHint')">
              <span class="tip-icon">?</span>
            </a-tooltip>
          </span>
          <a-select
            :value="eaf.colorDepth.value"
            :options="colorDepthOptions"
            :disabled="!eaf.hasItems.value || eaf.encodingMode.value === 'jpeg'"
            style="width: 100%"
            @update:value="eaf.setColorDepth"
          />
        </label>

        <label class="field field--full">
          <span class="field-label-with-tip">
            {{ $t("image.jpegQuality") }}
            <a-tooltip :title="$t('image.jpegQualityHint')">
              <span class="tip-icon">?</span>
            </a-tooltip>
          </span>
          <a-slider
            v-model:value="eaf.jpegQuality.value"
            :min="11"
            :max="100"
            :disabled="!eaf.hasItems.value || eaf.encodingMode.value !== 'jpeg'"
          />
          <span class="slider-value">{{ eaf.jpegQuality.value }}</span>
        </label>

        <label class="field field--full">
          <span class="field-label-with-tip">
            {{ $t("image.splitHeight") }}
            <a-tooltip :title="$t('image.splitHeightHint')">
              <span class="tip-icon">?</span>
            </a-tooltip>
          </span>
          <a-input-number
            v-model:value="eaf.splitHeight.value"
            :min="1"
            :max="1000"
            :disabled="!eaf.hasItems.value"
            style="width: 100%"
          />
        </label>
      </div>

      <div class="action-row">
        <div v-if="eaf.converting.value" class="convert-progress">
          <div class="convert-progress-meta">
            <span>{{ eaf.overallMessage.value || $t("image.converting") }}</span>
            <span>{{ eaf.overallProgress.value }}%</span>
          </div>
          <a-progress
            :percent="eaf.overallProgress.value"
            :show-info="false"
            size="small"
            status="active"
          />
        </div>
        <a-button
          type="primary"
          block
          :loading="eaf.converting.value"
          :disabled="!eaf.hasItems.value || eaf.converting.value || eaf.loading.value"
          @click="onConvert"
        >
          {{ $t("image.convertAll") }}
        </a-button>
        <a-button
          block
          :disabled="eaf.doneCount.value === 0 || eaf.converting.value"
          @click="downloadAllEaf"
        >
          {{ $t("image.downloadAllEaf") }}
        </a-button>
        <template v-if="eaf.selectedItem.value?.result">
          <a-divider style="margin: 4px 0" />
          <a-button
            block
            :disabled="eaf.converting.value"
            @click="downloadSelectedEaf"
          >
            {{ $t("image.downloadEaf") }}
          </a-button>
        </template>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { message } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import ImageBatchGrid from "../../shared/components/ImageBatchGrid.vue";
import EafPreview from "./components/EafPreview.vue";
import { useEafBatch } from "./composables/useEafBatch";
import { useTauriDragDrop } from "@/composables/useTauriDragDrop";
import { decodeEaf } from "@/utils/image/eaf";
import {
  saveBytesWithDialog,
  saveFilesToPickedDir,
} from "@/utils/image/shared/saveDialog";

const emit = defineEmits<{
  summary: [payload: { count: number; done: number }];
}>();

const { t } = useI18n();
const eaf = useEafBatch();

const externalPreview = shallowRef<{
  frames: HTMLCanvasElement[];
  width: number;
  height: number;
  bitDepth: number;
  expectedFrames: number;
} | null>(null);

const externalDecoding = ref(false);
const previewProgress = ref({ current: 0, total: 0 });
let previewAbort: AbortController | null = null;

const encodingOptions = computed(() => [
  { value: "rle", label: t("image.encodingRle") },
  { value: "rle_huffman", label: t("image.encodingRleHuffman") },
  { value: "jpeg", label: t("image.encodingJpeg") },
]);

const colorDepthOptions = computed(() => {
  if (eaf.encodingMode.value === "jpeg") {
    return [{ value: 24, label: t("image.colorDepth24") }];
  }
  return [
    { value: 4, label: t("image.colorDepth4") },
    { value: 8, label: t("image.colorDepth8") },
  ];
});

const selectedPreview = computed(() => {
  const item = eaf.selectedItem.value;
  if (!item) {
    return null;
  }
  return {
    url: item.objectUrl,
    name: item.fileName,
    width: item.naturalWidth,
    height: item.naturalHeight,
  };
});

const previewFrames = computed(() => {
  if (externalPreview.value) {
    return externalPreview.value.frames;
  }
  return eaf.selectedItem.value?.preview?.frames ?? [];
});

const previewMeta = computed(() => {
  if (externalPreview.value) {
    return {
      width: externalPreview.value.width,
      height: externalPreview.value.height,
      bitDepth: externalPreview.value.bitDepth,
    };
  }
  const preview = eaf.selectedItem.value?.preview;
  return {
    width: preview?.width ?? 0,
    height: preview?.height ?? 0,
    bitDepth: preview?.bitDepth ?? 8,
  };
});

/** 仍在解码时不自动播放，避免前几帧抖动 */
const previewLoading = computed(() => {
  if (externalPreview.value != null) {
    return externalDecoding.value;
  }
  const item = eaf.selectedItem.value;
  if (!item) {
    return false;
  }
  if (item.status === "converting") {
    return true;
  }
  const expected = item.result?.frameCount ?? 0;
  const got = item.preview?.frames.length ?? 0;
  return expected > 0 && got < expected;
});

const previewExpectedFrames = computed(() => {
  if (externalPreview.value?.expectedFrames) {
    return externalPreview.value.expectedFrames;
  }
  const item = eaf.selectedItem.value;
  return item?.result?.frameCount ?? item?.preview?.frameCount ?? 0;
});

const previewProgressText = computed(() => {
  if (!previewLoading.value) {
    return "";
  }
  if (externalPreview.value != null && previewProgress.value.total > 0) {
    return t("image.previewDecodeProgress", {
      current: previewProgress.value.current,
      total: previewProgress.value.total,
    });
  }
  const item = eaf.selectedItem.value;
  const expected = item?.result?.frameCount ?? 0;
  const got = item?.preview?.frames.length ?? 0;
  if (expected > 0) {
    return t("image.previewDecodeProgress", {
      current: got,
      total: expected,
    });
  }
  return "";
});

function abortPreviewDecode() {
  previewAbort?.abort();
  previewAbort = null;
  externalDecoding.value = false;
  previewProgress.value = { current: 0, total: 0 };
}

watch(
  [() => eaf.items.value.length, () => eaf.doneCount.value],
  ([count, done]) => emit("summary", { count, done }),
  { immediate: true }
);

async function pickGifs() {
  try {
    const n = await eaf.pickGifs();
    if (n > 0) {
      message.success(t("image.batchCount", { n: eaf.items.value.length }));
    }
  } catch (error) {
    console.error("[image/eaf] pick gif failed:", error);
    if (error instanceof Error && error.message === "NOT_GIF") {
      message.warning(t("image.notGif"));
      return;
    }
    message.error(
      error instanceof Error && error.message
        ? `${t("image.loadFailed")}: ${error.message}`
        : t("image.loadFailed")
    );
  }
}

function onHtmlDrop() {
  message.info(t("image.dropHintGif"));
}

async function pickExternalEaf() {
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: "EAF", extensions: ["eaf"] }],
    });
    if (selected == null || Array.isArray(selected)) {
      return;
    }

    abortPreviewDecode();
    const controller = new AbortController();
    previewAbort = controller;
    externalDecoding.value = true;
    previewProgress.value = { current: 0, total: 0 };
    externalPreview.value = {
      frames: [],
      width: 0,
      height: 0,
      bitDepth: 8,
      expectedFrames: 0,
    };

    const bytes = await readFile(selected);
    await decodeEaf(new Uint8Array(bytes), {
      signal: controller.signal,
      onProgress(current, total) {
        previewProgress.value = { current, total };
        if (externalPreview.value) {
          externalPreview.value = {
            ...externalPreview.value,
            expectedFrames: total,
          };
        }
      },
      onFrame(canvas, _index, meta) {
        const prev = externalPreview.value;
        const frames = prev ? [...prev.frames, canvas] : [canvas];
        externalPreview.value = {
          frames,
          width: meta.width,
          height: meta.height,
          bitDepth: meta.bitDepth,
          expectedFrames: previewProgress.value.total || frames.length,
        };
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    console.error("[image/eaf] open eaf preview failed:", error);
    message.error(t("image.previewLoadFailed"));
    externalPreview.value = null;
  } finally {
    if (previewAbort && !previewAbort.signal.aborted) {
      externalDecoding.value = false;
      previewAbort = null;
    }
  }
}

async function loadFromPaths(paths: string[]) {
  try {
    const n = await eaf.addPaths(paths);
    if (n > 0) {
      message.success(t("image.batchCount", { n: eaf.items.value.length }));
    }
  } catch (error) {
    console.error("[image/eaf] load paths failed:", error);
    if (error instanceof Error && error.message === "NOT_GIF") {
      message.warning(t("image.notGif"));
      return;
    }
    message.error(
      error instanceof Error && error.message
        ? `${t("image.loadFailed")}: ${error.message}`
        : t("image.loadFailed")
    );
  }
}

function onSelectItem(id: string) {
  abortPreviewDecode();
  externalPreview.value = null;
  eaf.selectItem(id);
}

function onClearAll() {
  abortPreviewDecode();
  eaf.clearAll();
  externalPreview.value = null;
}

function onWidthChange(value: number | string | null) {
  if (value === null || value === "") {
    eaf.setOutputWidth(null);
    return;
  }
  if (typeof value === "number") {
    eaf.setOutputWidth(value);
  }
}

function onHeightChange(value: number | string | null) {
  if (value === null || value === "") {
    eaf.setOutputHeight(null);
    return;
  }
  if (typeof value === "number") {
    eaf.setOutputHeight(value);
  }
}

async function onConvert() {
  if (!eaf.hasItems.value || eaf.converting.value || eaf.loading.value) {
    return;
  }
  abortPreviewDecode();
  externalPreview.value = null;
  try {
    const { success, failed } = await eaf.convertAll();
    if (failed === 0) {
      message.success(t("image.convertAllSuccess", { n: success }));
    } else {
      message.warning(t("image.convertPartial", { ok: success, fail: failed }));
    }
  } catch (error) {
    console.error("[image/eaf] convert failed:", error);
    message.error(
      error instanceof Error ? error.message : t("image.loadFailed")
    );
  }
}

async function downloadSelectedEaf() {
  const item = eaf.selectedItem.value;
  if (!item?.result) {
    return;
  }
  try {
    const path = await saveBytesWithDialog(
      item.result.bytes,
      `${eaf.baseNameFrom(item.fileName)}.eaf`,
      [{ name: "EAF", extensions: ["eaf"] }]
    );
    if (path) {
      message.success(t("image.saveSuccess", { path }));
    }
  } catch {
    message.error(t("image.saveFailed"));
  }
}

async function downloadAllEaf() {
  const files = eaf.items.value
    .filter((item) => item.result)
    .map((item) => ({
      name: `${eaf.baseNameFrom(item.fileName)}.eaf`,
      data: item.result!.bytes,
    }));
  if (!files.length) {
    return;
  }
  try {
    const dir = await saveFilesToPickedDir(files);
    if (dir) {
      message.success(t("image.saveAllSuccess", { n: files.length, path: dir }));
    }
  } catch {
    message.error(t("image.saveFailed"));
  }
}

useTauriDragDrop({
  onDrop(paths) {
    const gifPaths = paths.filter((path) => /\.gif$/i.test(path));
    if (gifPaths.length) {
      void loadFromPaths(gifPaths);
    }
  },
});

onBeforeUnmount(() => {
  abortPreviewDecode();
  eaf.clearAll();
});
</script>

<style scoped>
.workbench {
  display: contents;
}

.panel {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 12px;
  min-height: 0;
}

.panel-head {
  margin-bottom: 10px;
}

.panel-head--row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.panel-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.88);
}

.image-settings {
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
}

.image-workspace {
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.workspace-main {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workspace-main > :deep(*) {
  flex: 1 1 0;
  min-height: 0;
}

.workspace-preview {
  flex: 0 0 auto;
  max-height: 38%;
  min-height: 0;
  overflow: auto;
}

.selected-preview {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.selected-preview img {
  width: 72px;
  height: 72px;
  object-fit: contain;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  flex-shrink: 0;
}

.selected-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.selected-name {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-size {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}

.settings-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.block-title {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.62);
}

.block-hint {
  margin: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.38);
  line-height: 1.5;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}

.field--full {
  width: 100%;
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
}

.slider-value {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  text-align: right;
}

.field-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.action-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
}

.convert-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.convert-progress-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.62);
}

.convert-progress-meta span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
</style>
