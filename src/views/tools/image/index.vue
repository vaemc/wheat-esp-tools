<template>
  <div class="image-page">
    <aside class="image-sidebar panel">
      <header class="panel-head">
        <span class="panel-title">{{ $t("image.toolbox") }}</span>
      </header>

      <div class="tool-list">
        <button
          v-for="tool in tools"
          :key="tool.id"
          type="button"
          class="tool-item"
          :class="{ active: activeTool === tool.id, disabled: tool.disabled }"
          :disabled="tool.disabled"
          @click="activeTool = tool.id"
        >
          <span class="tool-icon">{{ tool.icon }}</span>
          <span class="tool-text">
            <span class="tool-name">{{ $t(tool.labelKey) }}</span>
          </span>
        </button>
      </div>

      <div v-if="hasImages" class="file-card">
        <div class="file-card-title">{{ $t("image.batchSummary") }}</div>
        <div class="file-card-name">
          {{ $t("image.batchCount", { n: items.length }) }}
        </div>
        <div v-if="doneCount > 0" class="file-card-meta">
          {{ $t("image.batchDone", { n: doneCount }) }}
        </div>
      </div>
    </aside>

    <section class="image-workspace">
      <ImageBatchGrid
        :items="items"
        :selected-id="selectedId"
        @pick="pickFiles"
        @drop-files="onDropFiles"
        @select="selectItem"
        @remove="removeItem"
        @clear-all="onClearAll"
      />
    </section>

    <aside class="image-settings panel">
      <header class="panel-head">
        <span class="panel-title">{{ $t("image.settings") }}</span>
      </header>

      <div v-if="selectedItem" class="selected-preview">
        <img :src="selectedItem.objectUrl" :alt="selectedItem.fileName" />
        <div class="selected-meta">
          <div class="selected-name" :title="selectedItem.fileName">
            {{ selectedItem.fileName }}
          </div>
          <div class="selected-size">
            {{ selectedItem.naturalWidth }} × {{ selectedItem.naturalHeight }}
          </div>
        </div>
      </div>

      <div class="settings-block">
        <div class="block-title">{{ $t("image.resize") }}</div>
        <p class="block-hint">{{ $t("image.resizeHint") }}</p>
        <div class="field-row">
          <label class="field">
            <span>{{ $t("image.width") }}</span>
            <a-input-number
              :value="outputWidth"
              :min="1"
              :max="4096"
              :disabled="!hasImages"
              :placeholder="$t('image.original')"
              @update:value="onWidthChange"
            />
          </label>
          <label class="field">
            <span>{{ $t("image.height") }}</span>
            <a-input-number
              :value="outputHeight"
              :min="1"
              :max="4096"
              :disabled="!hasImages"
              :placeholder="$t('image.original')"
              @update:value="onHeightChange"
            />
          </label>
        </div>
        <div class="field-inline">
          <a-checkbox v-model:checked="lockAspect" :disabled="!hasImages">
            {{ $t("image.lockAspect") }}
          </a-checkbox>
          <a-button
            size="small"
            type="link"
            :disabled="!hasImages"
            @click="resetOutputSize"
          >
            {{ $t("image.useOriginal") }}
          </a-button>
        </div>
      </div>

      <div class="settings-block">
        <div class="block-title">{{ $t("image.sjpgOptions") }}</div>
        <label class="field field--full">
          <span>{{ $t("image.jpegQuality") }}</span>
          <a-slider
            v-model:value="jpegQuality"
            :min="50"
            :max="100"
            :disabled="!hasImages"
          />
        </label>
        <label class="field field--full">
          <span>{{ $t("image.splitHeight") }}</span>
          <a-input-number
            v-model:value="splitHeight"
            :min="8"
            :max="64"
            :step="8"
            :disabled="!hasImages"
            style="width: 100%"
          />
        </label>
      </div>

      <div class="action-row">
        <a-button
          type="primary"
          block
          :loading="converting"
          :disabled="!hasImages"
          @click="onConvertAll"
        >
          {{ $t("image.convertAll") }}
        </a-button>
        <a-button
          block
          :disabled="doneCount === 0"
          @click="downloadAllSjpg"
        >
          {{ $t("image.downloadAllSjpg") }}
        </a-button>
        <a-button
          block
          :disabled="doneCount === 0"
          @click="downloadAllC"
        >
          {{ $t("image.downloadAllC") }}
        </a-button>
        <template v-if="selectedItem?.result">
          <a-divider style="margin: 4px 0" />
          <a-button block @click="downloadSelectedSjpg">
            {{ $t("image.downloadSjpg") }}
          </a-button>
          <a-button block @click="downloadSelectedC">
            {{ $t("image.downloadC") }}
          </a-button>
        </template>
      </div>
    </aside>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      multiple
      class="hidden-input"
      @change="onFileInputChange"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { message } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { readBinaryFile } from "@tauri-apps/api/fs";
import ImageBatchGrid from "./components/ImageBatchGrid.vue";
import { useImageBatch } from "./composables/useImageBatch";
import {
  downloadBytes,
  downloadText,
  encodeCanvasToSjpg,
} from "@/utils/sjpgEncoder";

const { t } = useI18n();

const tools = [
  { id: "sjpg", icon: "🧩", labelKey: "image.toolSjpg", disabled: false },
] as const;

const activeTool = ref<(typeof tools)[number]["id"]>("sjpg");
const fileInputRef = ref<HTMLInputElement | null>(null);
const converting = ref(false);

const {
  items,
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
  renderItemToCanvas,
  baseNameFrom,
} = useImageBatch();

const unlisteners: UnlistenFn[] = [];

function pickFiles() {
  fileInputRef.value?.click();
}

async function onDropFiles(files: FileList) {
  try {
    await addFiles(files);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_IMAGE") {
      message.warning(t("image.notImage"));
      return;
    }
    message.error(t("image.loadFailed"));
  }
}

async function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = input.files;
  input.value = "";
  if (files?.length) {
    await onDropFiles(files);
  }
}

async function loadFromPaths(paths: string[]) {
  try {
    await addPaths(paths, readBinaryFile);
  } catch {
    message.error(t("image.loadFailed"));
  }
}

function onWidthChange(value: number | string | null) {
  if (value === null || value === "") {
    setOutputWidth(null);
    return;
  }
  if (typeof value === "number") {
    setOutputWidth(value);
  }
}

function onHeightChange(value: number | string | null) {
  if (value === null || value === "") {
    setOutputHeight(null);
    return;
  }
  if (typeof value === "number") {
    setOutputHeight(value);
  }
}

function onClearAll() {
  clearAll();
}

async function onConvertAll() {
  if (!hasImages.value) {
    return;
  }

  converting.value = true;
  let success = 0;
  let failed = 0;

  try {
    for (const item of items.value) {
      const index = items.value.findIndex((entry) => entry.id === item.id);
      if (index < 0) {
        continue;
      }

      items.value[index] = { ...item, status: "converting", result: undefined };

      try {
        const canvas = renderItemToCanvas(item);
        const result = await encodeCanvasToSjpg(canvas, {
          quality: jpegQuality.value / 100,
          splitHeight: splitHeight.value,
          variableName: baseNameFrom(item.fileName),
        });
        items.value[index] = {
          ...items.value[index],
          status: "done",
          result,
        };
        success += 1;
      } catch {
        items.value[index] = {
          ...items.value[index],
          status: "error",
          result: undefined,
        };
        failed += 1;
      }
    }

    if (failed === 0) {
      message.success(t("image.convertAllSuccess", { n: success }));
    } else {
      message.warning(t("image.convertPartial", { ok: success, fail: failed }));
    }
  } finally {
    converting.value = false;
  }
}

function downloadSelectedSjpg() {
  const item = selectedItem.value;
  if (!item?.result) {
    return;
  }
  downloadBytes(item.result.bytes, `${baseNameFrom(item.fileName)}.sjpg`);
}

function downloadSelectedC() {
  const item = selectedItem.value;
  if (!item?.result) {
    return;
  }
  downloadText(item.result.cSource, `${baseNameFrom(item.fileName)}.c`);
}

function downloadAllSjpg() {
  for (const item of items.value) {
    if (item.result) {
      downloadBytes(item.result.bytes, `${baseNameFrom(item.fileName)}.sjpg`);
    }
  }
}

function downloadAllC() {
  for (const item of items.value) {
    if (item.result) {
      downloadText(item.result.cSource, `${baseNameFrom(item.fileName)}.c`);
    }
  }
}

onMounted(() => {
  void (async () => {
    try {
      const off = await listen<string[]>("tauri://file-drop", (event) => {
        const payload = event.payload;
        const paths = Array.isArray(payload) ? payload : [payload];
        const imagePaths = paths.filter(
          (path) => typeof path === "string" && /\.(jpe?g|png|webp|bmp|gif)$/i.test(path)
        );
        if (imagePaths.length) {
          void loadFromPaths(imagePaths);
        }
      });
      unlisteners.push(off);
    } catch {
      /* browser dev */
    }
  })();
});

onBeforeUnmount(() => {
  for (const off of unlisteners) {
    off();
  }
  clearAll();
});
</script>

<style scoped>
.image-page {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 280px;
  gap: 12px;
  height: 100%;
  min-height: 520px;
  padding: 12px 16px;
  box-sizing: border-box;
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

.panel-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.88);
}

.image-sidebar,
.image-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
}

.image-workspace {
  min-width: 0;
  min-height: 0;
  display: flex;
}

.tool-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tool-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.82);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease;
}

.tool-item:hover:not(.disabled) {
  border-color: rgba(125, 211, 252, 0.35);
  background: rgba(56, 189, 248, 0.06);
}

.tool-item.active {
  border-color: rgba(56, 189, 248, 0.55);
  background: rgba(56, 189, 248, 0.1);
}

.tool-item.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.tool-icon {
  font-size: 18px;
  line-height: 1;
}

.tool-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.tool-name {
  font-size: 13px;
  font-weight: 500;
}

.tool-badge {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.42);
}

.file-card {
  margin-top: auto;
  padding: 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.file-card-title {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  margin-bottom: 4px;
}

.file-card-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.88);
}

.file-card-meta {
  margin-top: 4px;
  font-size: 11px;
  color: #95de64;
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

.hidden-input {
  display: none;
}
</style>
