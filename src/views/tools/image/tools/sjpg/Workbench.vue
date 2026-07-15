<template>
  <div class="workbench">
    <section class="image-workspace">
      <div class="workspace-main">
        <ImageBatchGrid
          :items="sjpg.items.value"
          :selected-id="sjpg.selectedId.value"
          @pick="pickFiles"
          @drop-files="onDropFiles"
          @select="sjpg.selectItem"
          @remove="sjpg.removeItem"
          @clear-all="sjpg.clearAll"
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
        <p class="block-hint">{{ $t("image.resizeHint") }}</p>
        <div class="field-row">
          <label class="field">
            <span>{{ $t("image.width") }}</span>
            <a-input-number
              :value="sjpg.outputWidth.value"
              :min="1"
              :max="4096"
              :disabled="!sjpg.hasImages.value"
              :placeholder="$t('image.original')"
              @update:value="onWidthChange"
            />
          </label>
          <label class="field">
            <span>{{ $t("image.height") }}</span>
            <a-input-number
              :value="sjpg.outputHeight.value"
              :min="1"
              :max="4096"
              :disabled="!sjpg.hasImages.value"
              :placeholder="$t('image.original')"
              @update:value="onHeightChange"
            />
          </label>
        </div>
        <div class="field-inline">
          <a-checkbox
            v-model:checked="sjpg.lockAspect.value"
            :disabled="!sjpg.hasImages.value"
          >
            {{ $t("image.lockAspect") }}
          </a-checkbox>
          <a-button
            size="small"
            type="link"
            :disabled="!sjpg.hasImages.value"
            @click="sjpg.resetOutputSize"
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
            v-model:value="sjpg.jpegQuality.value"
            :min="50"
            :max="100"
            :disabled="!sjpg.hasImages.value"
          />
        </label>
        <label class="field field--full">
          <span>{{ $t("image.splitHeight") }}</span>
          <a-input-number
            v-model:value="sjpg.splitHeight.value"
            :min="8"
            :max="64"
            :step="8"
            :disabled="!sjpg.hasImages.value"
            style="width: 100%"
          />
        </label>
      </div>

      <div class="action-row">
        <a-button
          type="primary"
          block
          :loading="converting"
          :disabled="!sjpg.hasImages.value"
          @click="onConvert"
        >
          {{ $t("image.convertAll") }}
        </a-button>
        <a-button
          block
          :disabled="sjpg.doneCount.value === 0"
          @click="downloadAllSjpg"
        >
          {{ $t("image.downloadAllSjpg") }}
        </a-button>
        <a-button
          block
          :disabled="sjpg.doneCount.value === 0"
          @click="downloadAllC"
        >
          {{ $t("image.downloadAllC") }}
        </a-button>
        <template v-if="sjpg.selectedItem.value?.result">
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
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import { readFile } from "@tauri-apps/plugin-fs";
import ImageBatchGrid from "../../shared/components/ImageBatchGrid.vue";
import { useSjpgBatch } from "./composables/useSjpgBatch";
import { useTauriDragDrop } from "@/composables/useTauriDragDrop";
import { encodeCanvasToSjpg } from "@/utils/image/sjpg";
import {
  saveBytesWithDialog,
  saveFilesToPickedDir,
  saveTextWithDialog,
} from "@/utils/image/shared/saveDialog";

const emit = defineEmits<{
  summary: [payload: { count: number; done: number }];
}>();

const { t } = useI18n();
const fileInputRef = ref<HTMLInputElement | null>(null);
const converting = ref(false);
const sjpg = useSjpgBatch();

const selectedPreview = computed(() => {
  const item = sjpg.selectedItem.value;
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

watch(
  [() => sjpg.items.value.length, () => sjpg.doneCount.value],
  ([count, done]) => emit("summary", { count, done }),
  { immediate: true }
);

function pickFiles() {
  fileInputRef.value?.click();
}

async function onDropFiles(files: FileList | File[]) {
  try {
    await sjpg.addFiles(files);
  } catch (error) {
    console.error("[image/sjpg] add files failed:", error);
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
    await sjpg.addPaths(paths, readFile);
  } catch (error) {
    console.error("[image/sjpg] load paths failed:", error);
    message.error(
      error instanceof Error && error.message
        ? `${t("image.loadFailed")}: ${error.message}`
        : t("image.loadFailed")
    );
  }
}

function onWidthChange(value: number | string | null) {
  if (value === null || value === "") {
    sjpg.setOutputWidth(null);
    return;
  }
  if (typeof value === "number") {
    sjpg.setOutputWidth(value);
  }
}

function onHeightChange(value: number | string | null) {
  if (value === null || value === "") {
    sjpg.setOutputHeight(null);
    return;
  }
  if (typeof value === "number") {
    sjpg.setOutputHeight(value);
  }
}

async function onConvert() {
  if (!sjpg.hasImages.value) {
    return;
  }
  converting.value = true;
  let success = 0;
  let failed = 0;
  try {
    for (const item of sjpg.items.value) {
      const index = sjpg.items.value.findIndex((entry) => entry.id === item.id);
      if (index < 0) {
        continue;
      }
      sjpg.items.value[index] = {
        ...item,
        status: "converting",
        result: undefined,
      };
      try {
        const canvas = sjpg.renderItemToCanvas(item);
        const result = await encodeCanvasToSjpg(canvas, {
          quality: sjpg.jpegQuality.value / 100,
          splitHeight: sjpg.splitHeight.value,
          variableName: sjpg.baseNameFrom(item.fileName),
        });
        sjpg.items.value[index] = {
          ...sjpg.items.value[index],
          status: "done",
          result,
        };
        success += 1;
      } catch {
        sjpg.items.value[index] = {
          ...sjpg.items.value[index],
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

async function downloadSelectedSjpg() {
  const item = sjpg.selectedItem.value;
  if (!item?.result) {
    return;
  }
  try {
    const path = await saveBytesWithDialog(
      item.result.bytes,
      `${sjpg.baseNameFrom(item.fileName)}.sjpg`,
      [{ name: "SJPG", extensions: ["sjpg"] }]
    );
    if (path) {
      message.success(t("image.saveSuccess", { path }));
    }
  } catch {
    message.error(t("image.saveFailed"));
  }
}

async function downloadSelectedC() {
  const item = sjpg.selectedItem.value;
  if (!item?.result) {
    return;
  }
  try {
    const path = await saveTextWithDialog(
      item.result.cSource,
      `${sjpg.baseNameFrom(item.fileName)}.c`,
      [{ name: "C Source", extensions: ["c"] }]
    );
    if (path) {
      message.success(t("image.saveSuccess", { path }));
    }
  } catch {
    message.error(t("image.saveFailed"));
  }
}

async function downloadAllSjpg() {
  const files = sjpg.items.value
    .filter((item) => item.result)
    .map((item) => ({
      name: `${sjpg.baseNameFrom(item.fileName)}.sjpg`,
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

async function downloadAllC() {
  const encoder = new TextEncoder();
  const files = sjpg.items.value
    .filter((item) => item.result)
    .map((item) => ({
      name: `${sjpg.baseNameFrom(item.fileName)}.c`,
      data: encoder.encode(item.result!.cSource),
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
    const imagePaths = paths.filter((path) =>
      /\.(jpe?g|png|webp|bmp|gif)$/i.test(path)
    );
    if (imagePaths.length) {
      void loadFromPaths(imagePaths);
    }
  },
});

onBeforeUnmount(() => {
  sjpg.clearAll();
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

.panel-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.88);
}

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
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.workspace-main {
  flex: 1 1 0;
  min-height: 160px;
  display: flex;
  overflow: hidden;
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
