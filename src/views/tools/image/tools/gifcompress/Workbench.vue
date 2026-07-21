<template>
  <div class="workbench">
    <section class="image-workspace">
      <div class="workspace-main">
        <ImageBatchGrid
          :items="batch.items.value"
          :selected-id="batch.selectedId.value"
          :drop-title="$t('image.dropTitleGif')"
          :drop-hint="$t('image.dropHintGif')"
          @pick="onPick"
          @drop-files="onHtmlDrop"
          @select="onSelectItem"
          @remove="batch.removeItem"
          @clear-all="onClearAll"
        />
      </div>

      <div class="workspace-preview panel">
        <header class="panel-head panel-head--row">
          <span class="panel-title">{{ $t("image.gifPreview") }}</span>
          <a-button size="small" @click="pickExternalGif">
            {{ $t("image.openGifPreview") }}
          </a-button>
        </header>
        <GifPreview
          :src="previewSrc"
          :empty-text="$t('image.gifPreviewEmpty')"
          :width="previewMeta.width"
          :height="previewMeta.height"
          :frame-count="previewMeta.frameCount"
          :byte-length="previewMeta.byteLength"
          :source-byte-length="previewMeta.sourceByteLength"
          :duration-sec="previewMeta.durationSec"
          :fps="previewMeta.fps"
          :frames-label="$t('image.previewFrames')"
        />
      </div>
    </section>

    <aside class="image-settings panel">
      <header class="panel-head">
        <span class="panel-title">{{ $t("image.settings") }}</span>
      </header>

      <div v-if="selectedInfo" class="selected-preview">
        <img :src="selectedInfo.url" :alt="selectedInfo.name" />
        <div class="selected-meta">
          <div class="selected-name" :title="selectedInfo.name">
            {{ selectedInfo.name }}
          </div>
          <div class="selected-size">
            {{ selectedInfo.width }} × {{ selectedInfo.height }}
            · {{ selectedInfo.frameCount }}f
          </div>
          <div class="selected-info">
            <span
              >{{ $t("image.gifDuration") }}:
              {{ formatDurationSec(selectedInfo.durationSec, "—") }}</span
            >
            <span
              >{{ $t("image.gifFps") }}:
              {{ selectedInfo.fpsEstimate.toFixed(1) }}</span
            >
            <span
              >{{ $t("image.gifDelayRange") }}:
              {{ selectedInfo.delayMinMs }}–{{ selectedInfo.delayMaxMs }} ms
              ({{
                $t("image.gifDelayAvg", {
                  n: selectedInfo.delayAvgMs.toFixed(0),
                })
              }})</span
            >
            <span
              >{{ $t("image.gifFileSize") }}:
              {{ formatBytes(selectedInfo.byteLength) }}</span
            >
            <span v-if="selectedInfo.loopCount != null">
              {{ $t("image.gifLoop") }}:
              {{
                selectedInfo.loopCount === 0
                  ? $t("image.gifLoopInfinite")
                  : selectedInfo.loopCount
              }}
            </span>
            <span v-if="selectedInfo.hasGlobalPalette">{{
              $t("image.gifGlobalPalette")
            }}</span>
            <span v-if="selectedInfo.hasTransparency">{{
              $t("image.gifTransparency")
            }}</span>
          </div>
        </div>
      </div>

      <div class="settings-block">
        <div class="block-title">{{ $t("image.resize") }}</div>
        <p class="block-hint">{{ $t("image.resizeGifHint") }}</p>
        <div class="field-row">
          <label class="field">
            <span>{{ $t("image.width") }}</span>
            <a-input-number
              :value="batch.outputWidth.value"
              :min="1"
              :max="4096"
              :placeholder="$t('image.original')"
              @update:value="onWidthChange"
            />
          </label>
          <label class="field">
            <span>{{ $t("image.height") }}</span>
            <a-input-number
              :value="batch.outputHeight.value"
              :min="1"
              :max="4096"
              :placeholder="$t('image.original')"
              @update:value="onHeightChange"
            />
          </label>
        </div>
        <div class="field-inline">
          <a-checkbox v-model:checked="batch.lockAspect.value">
            {{ $t("image.lockAspect") }}
          </a-checkbox>
          <a-button size="small" type="link" @click="batch.resetOutputSize">
            {{ $t("image.useOriginal") }}
          </a-button>
        </div>
      </div>

      <div class="settings-block">
        <div class="block-title">{{ $t("image.gifCompressOptions") }}</div>
        <p class="block-hint">{{ $t("image.gifCompressStrategy") }}</p>

        <label class="field field--full">
          <span class="field-label-with-tip">
            {{ $t("image.gifFrameStep") }}
            <a-tooltip :title="$t('image.gifFrameStepHint')">
              <span class="tip-icon">?</span>
            </a-tooltip>
          </span>
          <a-input-number
            v-model:value="batch.frameStep.value"
            :min="0"
            :max="60"
            style="width: 100%"
          />
        </label>

        <label class="field field--full">
          <span class="field-label-with-tip">
            {{ $t("image.gifColors") }}
            <a-tooltip :title="$t('image.gifColorsHint')">
              <span class="tip-icon">?</span>
            </a-tooltip>
          </span>
          <a-select
            v-model:value="batch.colors.value"
            style="width: 100%"
            :options="colorOptions"
          />
        </label>

        <label class="field field--full">
          <a-checkbox v-model:checked="batch.dither.value">
            <span class="field-label-with-tip">
              {{ $t("image.gifDither") }}
              <a-tooltip :title="$t('image.gifDitherHint')">
                <span class="tip-icon">?</span>
              </a-tooltip>
            </span>
          </a-checkbox>
        </label>

        <label class="field field--full">
          <a-checkbox v-model:checked="batch.frameDiff.value">
            <span class="field-label-with-tip">
              {{ $t("image.gifFrameDiff") }}
              <a-tooltip :title="$t('image.gifFrameDiffHint')">
                <span class="tip-icon">?</span>
              </a-tooltip>
            </span>
          </a-checkbox>
        </label>

        <label class="field field--full">
          <span class="field-label-with-tip">
            {{ $t("image.gifLossy") }}
            <a-tooltip :title="$t('image.gifLossyHint')">
              <span class="tip-icon">?</span>
            </a-tooltip>
          </span>
          <div class="slider-row">
            <a-slider
              v-model:value="batch.lossy.value"
              :min="0"
              :max="200"
              :step="5"
              :disabled="!batch.frameDiff.value"
              style="flex: 1"
            />
            <span class="slider-value">{{ batch.lossy.value }}</span>
          </div>
        </label>

        <label class="field field--full">
          <span>{{ $t("image.gifDelayMode") }}</span>
          <a-select
            v-model:value="batch.delayMode.value"
            style="width: 100%"
            :options="delayModeOptions"
          />
        </label>

        <label class="field field--full">
          <span>{{ $t("image.gifFixedDelay") }} (ms)</span>
          <a-input-number
            v-model:value="batch.fixedDelayMs.value"
            :min="10"
            :max="5000"
            :step="10"
            :disabled="batch.delayMode.value !== 'fixed'"
            style="width: 100%"
          />
        </label>
      </div>

      <div
        v-if="selectedInfo?.result"
        class="settings-block"
      >
        <div class="block-title">{{ $t("image.gifResultInfo") }}</div>
        <div class="info-list">
          <div>
            {{ $t("image.gifOutFrames") }}:
            {{ selectedInfo.result.frameCount }}
          </div>
          <div>
            {{ $t("image.gifOutSize") }}:
            {{ formatBytes(selectedInfo.result.byteLength) }}
            ({{ sizeRatioText }})
          </div>
        </div>
      </div>

      <div class="action-row">
        <div v-if="batch.converting.value" class="convert-progress">
          <div class="convert-progress-meta">
            <span>{{ batch.overallMessage.value || $t("image.converting") }}</span>
            <span>{{ batch.overallProgress.value }}%</span>
          </div>
          <a-progress
            :percent="batch.overallProgress.value"
            :show-info="false"
            size="small"
            status="active"
          />
        </div>
        <a-button
          type="primary"
          block
          :loading="batch.converting.value"
          :disabled="!batch.hasItems.value || batch.loading.value || batch.converting.value"
          @click="onConvert"
        >
          {{ $t("image.convertAll") }}
        </a-button>
        <a-button
          block
          danger
          :disabled="!batch.converting.value"
          @click="onStopConvert"
        >
          {{ $t("image.stopConvert") }}
        </a-button>
        <a-button
          block
          :disabled="batch.doneCount.value === 0 || batch.converting.value"
          @click="downloadAll"
        >
          {{ $t("image.downloadAllGif") }}
        </a-button>
        <template v-if="batch.selectedItem.value?.result">
          <a-divider style="margin: 4px 0" />
          <a-button
            block
            :disabled="batch.converting.value"
            @click="downloadSelected"
          >
            {{ $t("image.downloadGif") }}
          </a-button>
        </template>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import prettyBytes from "pretty-bytes";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import ImageBatchGrid from "../../shared/components/ImageBatchGrid.vue";
import GifPreview from "./components/GifPreview.vue";
import {
  useGifCompressBatch,
  type GifRichProbeResult,
} from "./composables/useGifCompressBatch";
import { useTauriDragDrop } from "@/composables/useTauriDragDrop";
import {
  saveBytesWithDialog,
  saveFilesToPickedDir,
} from "@/utils/image/shared/saveDialog";
import {
  durationSecFromDelays,
  formatDurationSec,
} from "@/utils/image/shared/formatDuration";

const emit = defineEmits<{
  summary: [payload: { count: number; done: number }];
}>();

const { t } = useI18n();
const batch = useGifCompressBatch();

/** 独立打开的 .gif 预览（不进入批量列表）；优先于压缩结果展示 */
const externalPreview = ref<{
  objectUrl: string;
  width: number;
  height: number;
  frameCount: number;
  byteLength: number;
  durationSec: number;
  fps: number;
} | null>(null);

const colorOptions = [
  { value: 256, label: "256" },
  { value: 128, label: "128" },
  { value: 64, label: "64" },
  { value: 32, label: "32" },
  { value: 16, label: "16" },
  { value: 8, label: "8" },
];

const delayModeOptions = computed(() => [
  { value: "keep", label: t("image.gifDelayKeep") },
  { value: "fixed", label: t("image.gifDelayFixed") },
]);

const selectedInfo = computed(() => {
  const item = batch.selectedItem.value;
  if (!item) {
    return null;
  }
  return {
    name: item.fileName,
    url: item.objectUrl,
    width: item.naturalWidth,
    height: item.naturalHeight,
    frameCount: item.frameCount,
    fpsEstimate: item.fpsEstimate,
    durationSec: item.durationSec,
    delayMinMs: item.delayMinMs,
    delayMaxMs: item.delayMaxMs,
    delayAvgMs: item.delayAvgMs,
    byteLength: item.byteLength,
    loopCount: item.loopCount,
    hasGlobalPalette: item.hasGlobalPalette,
    hasTransparency: item.hasTransparency,
    result: item.result,
  };
});

const previewSrc = computed(
  () =>
    externalPreview.value?.objectUrl ??
    batch.selectedItem.value?.result?.objectUrl ??
    null
);

const previewMeta = computed(() => {
  const ext = externalPreview.value;
  if (ext) {
    return {
      width: ext.width,
      height: ext.height,
      frameCount: ext.frameCount,
      byteLength: ext.byteLength,
      sourceByteLength: 0,
      durationSec: ext.durationSec,
      fps: ext.fps,
    };
  }

  const item = batch.selectedItem.value;
  const result = item?.result;
  if (result && item) {
    // 输出时长/帧率按当前参数估算，避免与源帧数混用
    let durationSec = 0;
    let fps = 0;
    if (batch.delayMode.value === "fixed") {
      const delay = Math.max(10, batch.fixedDelayMs.value);
      durationSec = (result.frameCount * delay) / 1000;
      fps = 1000 / delay;
    } else if (item.durationSec > 0) {
      durationSec = item.durationSec;
      fps = result.frameCount / item.durationSec;
    }
    return {
      width: result.width,
      height: result.height,
      frameCount: result.frameCount,
      byteLength: result.byteLength,
      sourceByteLength: item.byteLength,
      durationSec,
      fps,
    };
  }

  return {
    width: 0,
    height: 0,
    frameCount: 0,
    byteLength: 0,
    sourceByteLength: 0,
    durationSec: 0,
    fps: 0,
  };
});

const sizeRatioText = computed(() => {
  const item = batch.selectedItem.value;
  if (!item?.result || !item.byteLength) {
    return "—";
  }
  const ratio = (item.result.byteLength / item.byteLength) * 100;
  return `${ratio.toFixed(0)}%`;
});

watch(
  [() => batch.items.value.length, () => batch.doneCount.value],
  ([count, done]) => emit("summary", { count, done }),
  { immediate: true }
);

function formatBytes(n: number) {
  return prettyBytes(n || 0);
}

async function onPick() {
  try {
    await batch.pickGifs();
  } catch (error) {
    reportError(error);
  }
}

async function onHtmlDrop(files: FileList | File[]) {
  // HTML drop in Tauri may not give paths; rely on Tauri drag-drop
  void files;
  message.info(t("image.dropHintGif"));
}

function clearExternalPreview() {
  externalPreview.value = null;
}

function onSelectItem(id: string) {
  clearExternalPreview();
  batch.selectItem(id);
}

function onClearAll() {
  clearExternalPreview();
  batch.clearAll();
}

function onStopConvert() {
  batch.stopConvert();
}

async function pickExternalGif() {
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: "GIF", extensions: ["gif"] }],
    });
    if (selected == null || Array.isArray(selected)) {
      return;
    }
    const info = await invoke<GifRichProbeResult>("probe_gif_rich", {
      path: selected,
    });
    externalPreview.value = {
      objectUrl: convertFileSrc(info.path || selected),
      width: info.width,
      height: info.height,
      frameCount: info.frameCount,
      byteLength: Number(info.byteLength) || 0,
      durationSec: durationSecFromDelays(
        info.delaysMs,
        info.frameCount,
        info.delayAvgMs
      ),
      fps: info.fpsEstimate ?? 0,
    };
  } catch (error) {
    console.error("[image/gifcompress] open gif preview failed:", error);
    message.error(t("image.gifPreviewLoadFailed"));
    clearExternalPreview();
  }
}

function onWidthChange(value: number | string | null) {
  if (value === null || value === "") {
    batch.setOutputWidth(null);
    return;
  }
  if (typeof value === "number") {
    batch.setOutputWidth(value);
  }
}

function onHeightChange(value: number | string | null) {
  if (value === null || value === "") {
    batch.setOutputHeight(null);
    return;
  }
  if (typeof value === "number") {
    batch.setOutputHeight(value);
  }
}

function reportError(error: unknown) {
  console.error("[image/gifcompress]", error);
  const code = error instanceof Error ? error.message : "";
  if (code === "NOT_GIF") {
    message.warning(t("image.notGif"));
    return;
  }
  message.error(
    error instanceof Error && error.message
      ? `${t("image.loadFailed")}: ${error.message}`
      : t("image.loadFailed")
  );
}

async function onConvert() {
  try {
    const { success, failed, aborted } = await batch.convertAll();
    if (aborted) {
      message.info(t("image.convertStopped"));
      return;
    }
    if (failed === 0) {
      message.success(t("image.convertAllSuccess", { n: success }));
    } else {
      message.warning(t("image.convertPartial", { ok: success, fail: failed }));
    }
  } catch (error) {
    reportError(error);
  }
}

async function downloadSelected() {
  const item = batch.selectedItem.value;
  if (!item?.result) {
    return;
  }
  try {
    const path = await saveBytesWithDialog(
      item.result.bytes,
      `${batch.baseNameFrom(item.fileName)}.gif`,
      [{ name: "GIF", extensions: ["gif"] }]
    );
    if (path) {
      message.success(t("image.saveSuccess", { path }));
    }
  } catch {
    message.error(t("image.saveFailed"));
  }
}

async function downloadAll() {
  const files = batch.items.value
    .filter((item) => item.result)
    .map((item) => ({
      name: `${batch.baseNameFrom(item.fileName)}.gif`,
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
    if (!gifPaths.length) {
      message.warning(t("image.notGif"));
      return;
    }
    void batch.addPaths(gifPaths).catch(reportError);
  },
});

onBeforeUnmount(() => {
  clearExternalPreview();
  batch.clearAll();
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
  gap: 12px;
  padding: 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.selected-preview img {
  width: 88px;
  height: 88px;
  object-fit: contain;
  border-radius: 6px;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.35);
}

.selected-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.selected-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.88);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-size {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.selected-info {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.55);
}

.settings-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.block-title {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

.block-hint {
  margin: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1.4;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.4;
}

.field-row {
  display: flex;
  gap: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  flex: 1;
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

.field-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.slider-value {
  min-width: 32px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
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
