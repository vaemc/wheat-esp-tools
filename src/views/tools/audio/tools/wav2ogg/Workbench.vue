<template>
  <div class="workbench">
    <section class="audio-workspace">
      <div class="workspace-main">
        <AudioBatchGrid
          :items="batch.items.value"
          :selected-id="batch.selectedId.value"
          @pick="pickFiles"
          @drop-files="onDropFiles"
          @select="onSelectItem"
          @remove="onRemoveItem"
          @clear-all="onClearAll"
        />
      </div>

      <div class="workspace-preview panel">
        <header class="panel-head panel-head--row">
          <span class="panel-title">{{ $t("audio.oggPreview") }}</span>
          <a-button size="small" @click="pickExternalOgg">
            {{ $t("audio.openOggPreview") }}
          </a-button>
        </header>
        <OggPreview
          :src="previewSrc"
          :file-name="previewMeta.fileName"
          :sample-rate="previewMeta.sampleRate"
          :channels="previewMeta.channels"
          :bit-depth="previewMeta.bitDepth"
          :bitrate-kbps="previewMeta.bitrateKbps"
          :complexity="previewMeta.complexity"
          :byte-length="previewMeta.byteLength"
          :empty-text="$t('audio.previewEmpty')"
          :play-label="$t('audio.previewPlay')"
          :pause-label="$t('audio.previewPause')"
          :loop-label="$t('audio.previewLoop')"
        />
      </div>
    </section>

    <aside class="audio-settings panel">
      <header class="panel-head">
        <span class="panel-title">{{ $t("audio.settings") }}</span>
      </header>

      <div v-if="selectedMeta" class="selected-preview">
        <div class="preview-icon">
          <CustomerServiceOutlined />
        </div>
        <div class="selected-meta">
          <div class="selected-name" :title="selectedMeta.name">
            {{ selectedMeta.name }}
          </div>
          <div class="selected-size">
            {{ formatDuration(selectedMeta.durationSec) }}
            · {{ selectedMeta.sampleRate }} Hz
            · {{ selectedMeta.bitsPerSample }} bit
          </div>
        </div>
      </div>

      <div v-if="selectedMeta" class="settings-block player-block">
        <div class="block-title">{{ $t("audio.sourcePreview") }}</div>
        <div class="player-row">
          <span class="player-label">WAV</span>
          <audio
            class="player"
            controls
            preload="metadata"
            :src="selectedMeta.sourceUrl"
          />
        </div>
      </div>

      <div class="settings-block">
        <div class="block-title">{{ $t("audio.oggOptions") }}</div>
        <p class="block-hint">{{ $t("audio.oggOptionsHint") }}</p>

        <label class="field field--full">
          <span class="field-label-with-tip">
            {{ $t("audio.sampleRate") }}
            <a-tooltip :title="$t('audio.sampleRateHint')">
              <span class="tip-icon">?</span>
            </a-tooltip>
          </span>
          <a-select
            v-model:value="batch.sampleRate.value"
            :disabled="!batch.hasItems.value"
            style="width: 100%"
            :options="sampleRateOptions"
          />
        </label>

        <label class="field field--full">
          <span>{{ $t("audio.bitDepth") }}</span>
          <a-select
            v-model:value="batch.bitDepth.value"
            :disabled="!batch.hasItems.value"
            style="width: 100%"
            :options="bitDepthOptions"
          />
        </label>

        <label class="field field--full">
          <span class="field-label-with-tip">
            {{ $t("audio.bitrate") }} (kbps)
            <a-tooltip :title="$t('audio.bitrateHint')">
              <span class="tip-icon">?</span>
            </a-tooltip>
          </span>
          <a-input-number
            v-model:value="batch.bitrateKbps.value"
            :min="6"
            :max="128"
            :step="1"
            :disabled="!batch.hasItems.value"
            style="width: 100%"
          />
        </label>

        <label class="field field--full">
          <span class="field-label-with-tip">
            {{ $t("audio.compressionQuality") }} (0–10)
            <a-tooltip :title="$t('audio.compressionQualityHint')">
              <span class="tip-icon">?</span>
            </a-tooltip>
          </span>
          <a-slider
            v-model:value="batch.complexity.value"
            :min="0"
            :max="10"
            :disabled="!batch.hasItems.value"
          />
          <span class="slider-value">{{ batch.complexity.value }}</span>
        </label>

        <label class="field field--full">
          <span>{{ $t("audio.channelMode") }}</span>
          <a-select
            v-model:value="batch.channelMode.value"
            :disabled="!batch.hasItems.value"
            style="width: 100%"
            :options="channelModeOptions"
          />
        </label>

        <label class="field field--full">
          <span>{{ $t("audio.duration") }} (s)</span>
          <a-input-number
            :value="batch.durationSec.value"
            :min="0.01"
            :max="3600"
            :step="0.01"
            :precision="2"
            :disabled="!batch.hasItems.value"
            :placeholder="$t('audio.durationFull')"
            style="width: 100%"
            @update:value="onDurationChange"
          />
        </label>

        <label class="field field--full">
          <span>{{ $t("audio.frameDuration") }} (ms)</span>
          <a-select
            v-model:value="batch.frameDurationMs.value"
            :disabled="!batch.hasItems.value"
            style="width: 100%"
            :options="frameDurationOptions"
          />
        </label>
      </div>

      <div class="action-row">
        <a-button
          type="primary"
          block
          :loading="converting"
          :disabled="!batch.hasItems.value"
          @click="onConvert"
        >
          {{ $t("audio.convertAll") }}
        </a-button>
        <a-button
          block
          :disabled="batch.doneCount.value === 0"
          @click="downloadAllOgg"
        >
          {{ $t("audio.downloadAllOgg") }}
        </a-button>
        <template v-if="batch.selectedItem.value?.result">
          <a-divider style="margin: 4px 0" />
          <a-button block @click="downloadSelectedOgg">
            {{ $t("audio.downloadOgg") }}
          </a-button>
        </template>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { CustomerServiceOutlined } from "@ant-design/icons-vue";
import { message } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import AudioBatchGrid from "../../shared/components/AudioBatchGrid.vue";
import OggPreview from "./components/OggPreview.vue";
import { useWav2OggBatch } from "./composables/useWav2OggBatch";
import { useTauriDragDrop } from "@/composables/useTauriDragDrop";
import { convertWavToOgg } from "@/utils/audio/ogg/encoder";
import { probeOggOpus } from "@/utils/audio/ogg/probe";
import { formatDuration } from "@/utils/audio/formatDuration";
import {
  saveBytesWithDialog,
  saveFilesToPickedDir,
} from "@/utils/image/shared/saveDialog";

const emit = defineEmits<{
  summary: [payload: { count: number; done: number }];
}>();

const { t } = useI18n();
const converting = ref(false);
const batch = useWav2OggBatch();

/** 外部打开的 OGG（优先于批次结果预览） */
const externalPreview = shallowRef<{
  objectUrl: string;
  fileName: string;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  bitrateKbps: number;
  complexity: number;
  byteLength: number;
} | null>(null);

const sampleRateOptions = [
  { value: 8000, label: "8000 Hz" },
  { value: 12000, label: "12000 Hz" },
  { value: 16000, label: "16000 Hz" },
  { value: 24000, label: "24000 Hz" },
  { value: 48000, label: "48000 Hz" },
];

const bitDepthOptions = [
  { value: 16, label: "16 bit" },
  { value: 24, label: "24 bit" },
  { value: 32, label: "32 bit" },
];

const channelModeOptions = computed(() => [
  { value: "keep", label: t("audio.channelKeep") },
  { value: "mono", label: t("audio.channelMono") },
  { value: "stereo", label: t("audio.channelStereo") },
]);

const frameDurationOptions = [
  { value: 20, label: "20" },
  { value: 40, label: "40" },
  { value: 60, label: "60" },
];

const selectedMeta = computed(() => {
  const item = batch.selectedItem.value;
  if (!item) {
    return null;
  }
  return {
    name: item.fileName,
    durationSec: item.durationSec,
    sampleRate: item.sampleRate,
    bitsPerSample: item.bitsPerSample,
    sourceUrl: item.sourceUrl,
  };
});

const previewSrc = computed(() => {
  if (externalPreview.value) {
    return externalPreview.value.objectUrl;
  }
  return batch.selectedItem.value?.result?.objectUrl ?? null;
});

const previewMeta = computed(() => {
  if (externalPreview.value) {
    return {
      fileName: externalPreview.value.fileName,
      sampleRate: externalPreview.value.sampleRate,
      channels: externalPreview.value.channels,
      bitDepth: externalPreview.value.bitDepth,
      bitrateKbps: externalPreview.value.bitrateKbps,
      complexity: externalPreview.value.complexity,
      byteLength: externalPreview.value.byteLength,
    };
  }
  const item = batch.selectedItem.value;
  const result = item?.result;
  if (!result) {
    return {
      fileName: "",
      sampleRate: 0,
      channels: 0,
      bitDepth: 0,
      bitrateKbps: 0,
      complexity: -1,
      byteLength: 0,
    };
  }
  return {
    fileName: `${batch.baseNameFrom(item!.fileName)}.ogg`,
    sampleRate: result.sampleRate,
    channels: result.channels,
    bitDepth: result.bitDepth || batch.bitDepth.value,
    // 显示转换时的目标码率，勿用文件体积反推（短音频含 Ogg 头会偏高）
    bitrateKbps: result.bitrateKbps || batch.bitrateKbps.value,
    complexity:
      typeof result.complexity === "number"
        ? result.complexity
        : batch.complexity.value,
    byteLength: result.bytes.length,
  };
});

watch(
  [() => batch.items.value.length, () => batch.doneCount.value],
  ([count, done]) => emit("summary", { count, done }),
  { immediate: true }
);

function clearExternalPreview() {
  if (externalPreview.value?.objectUrl) {
    URL.revokeObjectURL(externalPreview.value.objectUrl);
  }
  externalPreview.value = null;
}

function reportLoadError(error: unknown, where: string) {
  console.error(`[audio/wav2ogg] ${where}:`, error);
  const code = error instanceof Error ? error.message : "";
  if (code === "NOT_WAV") {
    message.warning(t("audio.notWav"));
    return;
  }
  if (code === "UNSUPPORTED_WAV") {
    message.error(t("audio.unsupportedWav"));
    return;
  }
  if (code === "NOT_OGG_OPUS") {
    message.error(t("audio.onlyOggSupported"));
    return;
  }
  message.error(
    error instanceof Error && error.message
      ? `${t("audio.loadFailed")}: ${error.message}`
      : t("audio.loadFailed")
  );
}

async function pickFiles() {
  try {
    const selected = await open({
      multiple: true,
      filters: [{ name: "WAV", extensions: ["wav"] }],
    });
    if (selected == null) {
      return;
    }
    const paths = Array.isArray(selected) ? selected : [selected];
    await loadFromPaths(paths);
  } catch (error) {
    reportLoadError(error, "pick files failed");
  }
}

async function onDropFiles(files: FileList | File[]) {
  try {
    await batch.addFiles(files);
  } catch (error) {
    reportLoadError(error, "add files failed");
  }
}

async function loadFromPaths(paths: string[]) {
  try {
    await batch.addPaths(paths, readFile);
    if (paths.length) {
      message.success(t("audio.batchCount", { n: batch.items.value.length }));
    }
  } catch (error) {
    reportLoadError(error, "load paths failed");
  }
}

function onSelectItem(id: string) {
  clearExternalPreview();
  batch.selectItem(id);
}

function onRemoveItem(id: string) {
  batch.removeItem(id);
}

function onClearAll() {
  clearExternalPreview();
  batch.clearAll();
}

function onDurationChange(value: number | string | null) {
  if (value === null || value === "") {
    batch.durationSec.value = null;
    return;
  }
  if (typeof value === "number" && value > 0) {
    batch.durationSec.value = value;
  }
}

async function pickExternalOgg() {
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: "OGG", extensions: ["ogg", "opus"] }],
    });
    if (selected == null || Array.isArray(selected)) {
      return;
    }
    const bytes = new Uint8Array(await readFile(selected));
    const info = probeOggOpus(bytes);
    const name = selected.split(/[/\\]/).pop() ?? "audio.ogg";
    clearExternalPreview();
    const objectUrl = URL.createObjectURL(
      new Blob([new Uint8Array(bytes)], { type: "audio/ogg" })
    );
    externalPreview.value = {
      objectUrl,
      fileName: name,
      sampleRate: info.sampleRate,
      channels: info.channels,
      bitDepth: 16,
      bitrateKbps: 0,
      complexity: -1,
      byteLength: info.byteLength,
    };
  } catch (error) {
    reportLoadError(error, "open ogg preview failed");
  }
}

/** 批量转换后默认选中并预览第一个成功的 OGG */
function focusFirstConverted() {
  clearExternalPreview();
  const first = batch.items.value.find((item) => item.result);
  if (first) {
    batch.selectItem(first.id);
  }
}

async function onConvert() {
  if (!batch.hasItems.value) {
    return;
  }
  converting.value = true;
  clearExternalPreview();
  let success = 0;
  let failed = 0;
  try {
    for (const item of [...batch.items.value]) {
      batch.setStatus(item.id, "converting");
      try {
        const result = await convertWavToOgg(item.sourceBytes, {
          sampleRate: batch.sampleRate.value,
          bitrateKbps: batch.bitrateKbps.value,
          bitDepth: batch.bitDepth.value,
          durationSec: batch.durationSec.value,
          channelMode: batch.channelMode.value,
          complexity: batch.complexity.value,
          frameDurationMs: batch.frameDurationMs.value,
        });
        batch.setResult(item.id, result);
        success += 1;
      } catch (error) {
        console.error("[audio/wav2ogg] convert failed:", error);
        batch.setStatus(item.id, "error");
        failed += 1;
      }
    }
    focusFirstConverted();
    if (failed === 0) {
      message.success(t("audio.convertAllSuccess", { n: success }));
    } else {
      message.warning(t("audio.convertPartial", { ok: success, fail: failed }));
    }
  } finally {
    converting.value = false;
  }
}

async function downloadSelectedOgg() {
  const item = batch.selectedItem.value;
  if (!item?.result) {
    return;
  }
  try {
    const path = await saveBytesWithDialog(
      item.result.bytes,
      `${batch.baseNameFrom(item.fileName)}.ogg`,
      [{ name: "OGG", extensions: ["ogg"] }]
    );
    if (path) {
      message.success(t("audio.saveSuccess", { path }));
    }
  } catch {
    message.error(t("audio.saveFailed"));
  }
}

async function downloadAllOgg() {
  const files = batch.items.value
    .filter((item) => item.result)
    .map((item) => ({
      name: `${batch.baseNameFrom(item.fileName)}.ogg`,
      data: item.result!.bytes,
    }));
  if (!files.length) {
    return;
  }
  try {
    const dir = await saveFilesToPickedDir(files);
    if (dir) {
      message.success(t("audio.saveAllSuccess", { n: files.length, path: dir }));
    }
  } catch {
    message.error(t("audio.saveFailed"));
  }
}

useTauriDragDrop({
  onDrop(paths) {
    const wavPaths = paths.filter((path) => /\.wav$/i.test(path));
    const oggPaths = paths.filter((path) => /\.(ogg|opus)$/i.test(path));
    if (wavPaths.length) {
      void loadFromPaths(wavPaths);
      return;
    }
    if (oggPaths.length === 1) {
      void (async () => {
        try {
          const path = oggPaths[0]!;
          const bytes = new Uint8Array(await readFile(path));
          const info = probeOggOpus(bytes);
          const name = path.split(/[/\\]/).pop() ?? "audio.ogg";
          clearExternalPreview();
          externalPreview.value = {
            objectUrl: URL.createObjectURL(
              new Blob([new Uint8Array(bytes)], { type: "audio/ogg" })
            ),
            fileName: name,
            sampleRate: info.sampleRate,
            channels: info.channels,
            bitDepth: 16,
            bitrateKbps: 0,
            complexity: -1,
            byteLength: info.byteLength,
          };
        } catch (error) {
          reportLoadError(error, "drop ogg failed");
        }
      })();
      return;
    }
    message.warning(t("audio.notWav"));
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

.audio-settings {
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
}

.audio-workspace {
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

.preview-icon {
  width: 72px;
  height: 72px;
  border-radius: 6px;
  background: rgba(56, 189, 248, 0.1);
  color: #7dd3fc;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
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

.player-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.player-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}

.player {
  width: 100%;
  height: 32px;
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
  color: rgba(255, 255, 255, 0.55);
  align-self: flex-end;
}

.action-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
}
</style>
