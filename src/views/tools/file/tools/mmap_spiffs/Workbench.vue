<template>
  <div class="workbench">
    <section
      class="drop-zone panel"
      :class="{ 'drop-zone--over': pack.dragOver.value, 'drop-zone--filled': pack.hasDir.value }"
      @click="onZoneClick"
      @dragover.prevent="pack.dragOver.value = true"
      @dragleave.prevent="pack.dragOver.value = false"
      @drop.prevent="pack.dragOver.value = false"
    >
      <template v-if="!pack.hasDir.value">
        <div class="drop-icon">
          <MenuIcon name="mmap_spiffs" />
        </div>
        <div class="drop-title-row">
          <div class="drop-title">{{ $t("file.dropTitle") }}</div>
          <a-tooltip placement="bottom" :overlay-inner-style="{ maxWidth: '360px' }">
            <template #title>
              <div class="drop-tip-body">
                <p>{{ $t("file.dropDiffTip") }}</p>
                <p v-for="(line, i) in dropFilesTipLines" :key="i">{{ line }}</p>
              </div>
            </template>
            <span class="tip-icon" @click.stop>?</span>
          </a-tooltip>
        </div>
        <p class="drop-hint">{{ $t("file.dropHint") }}</p>
        <p class="drop-steps">{{ $t("file.dropSteps") }}</p>
        <a-button type="primary" :loading="pack.probing.value" @click.stop="pack.pickDir()">
          {{ $t("file.pickDir") }}
        </a-button>
      </template>
      <template v-else>
        <div class="dir-card">
          <div class="dir-badge" aria-hidden="true">
            <FolderOpenOutlined />
          </div>
          <div class="dir-main">
            <div class="dir-head">
              <div class="dir-meta">
                <div class="dir-name" :title="pack.dirPath.value ?? ''">
                  {{ pack.dirName.value }}
                </div>
                <div class="dir-path" :title="pack.dirPath.value ?? ''">
                  {{ pack.dirPath.value }}
                </div>
              </div>
              <div class="dir-actions">
                <a-button size="small" :loading="pack.probing.value" @click.stop="pack.pickDir()">
                  {{ $t("file.repickDir") }}
                </a-button>
                <a-button size="small" danger @click.stop="pack.clearDir()">
                  {{ $t("file.clearDir") }}
                </a-button>
              </div>
            </div>
            <div class="dir-stats">
              <span class="dir-stat-pill">{{ $t("file.batchCount", { n: pack.fileCount.value }) }}</span>
              <span v-if="pack.fileCount.value" class="dir-stat-pill">
                {{ pack.formatBytes(pack.listTotalBytes.value) }}
              </span>
              <span v-if="pack.hasExistingIndex.value" class="dir-stat-pill dir-stat-pill--ok">
                {{ $t("file.indexExistingBadge") }}
              </span>
            </div>
            <div class="index-options" @click.stop>
              <a-checkbox
                v-model:checked="pack.autoGenerateIndex.value"
                :disabled="pack.hasExistingIndex.value"
              >
                {{ $t("file.autoGenerateIndex") }}
              </a-checkbox>
              <p class="index-option-hint">
                {{
                  pack.hasExistingIndex.value
                    ? $t("file.indexUseExistingHint")
                    : $t("file.indexAutoHint")
                }}
              </p>
            </div>
          </div>
        </div>
      </template>
    </section>

    <section class="file-list panel">
      <header class="panel-head panel-head--row">
        <span class="panel-title">{{ $t("file.fileList") }}</span>
        <div class="header-actions">
          <a-button
            :disabled="!pack.canPreview.value"
            :loading="pack.previewingManifest.value"
            @click="pack.previewManifestJson()"
          >
            {{ $t("file.previewManifest") }}
          </a-button>
          <a-button
            :disabled="!pack.canPreview.value"
            :loading="pack.previewing.value"
            @click="pack.previewMapTable()"
          >
            {{ $t("file.previewIndex") }}
          </a-button>
          <a-button
            :loading="pack.probing.value && pack.listSource.value === 'bin'"
            @click="pack.openBinPreview()"
          >
            {{ $t("file.openBinPreview") }}
          </a-button>
          <a-button
            type="primary"
            :disabled="!pack.canPack.value"
            :loading="pack.packing.value"
            @click="pack.pack()"
          >
            {{ $t("file.pack") }}
          </a-button>
        </div>
      </header>

      <div
        v-if="pack.hasBinView.value"
        class="bin-banner"
      >
        <span class="bin-banner-label">{{ $t("file.binListBanner") }}</span>
        <span class="bin-banner-path" :title="pack.openedBinPath.value ?? ''">
          {{ pack.openedBinName.value }}
        </span>
        <span class="dir-stat-pill">{{ $t("file.batchCount", { n: pack.fileCount.value }) }}</span>
        <span class="dir-stat-pill">{{ pack.formatBytes(pack.listTotalBytes.value) }}</span>
      </div>

      <div v-if="pack.probe.value?.errors?.length && pack.listSource.value === 'dir'" class="error-box">
        <div v-for="(err, i) in pack.probe.value.errors" :key="i" class="error-line">
          {{ err }}
        </div>
      </div>

      <div v-if="pack.listSource.value === 'none'" class="list-empty">
        {{ $t("file.listEmpty") }}
      </div>
      <div v-else-if="pack.probing.value" class="list-empty">
        {{ $t("file.probing") }}
      </div>
      <div v-else-if="!pack.fileCount.value" class="list-empty">
        {{ pack.listSource.value === "bin" ? $t("file.emptyBin") : $t("file.emptyDir") }}
      </div>
      <div v-else class="list-scroll">
        <div
          v-for="item in pack.listFiles.value"
          :key="item.rel"
          class="list-row"
        >
          <span class="list-rel" :title="item.rel">{{ item.rel }}</span>
          <span class="list-size">{{ pack.formatBytes(item.size) }}</span>
        </div>
      </div>

      <div v-if="pack.lastPack.value" class="pack-result">
        <div class="result-title">{{ $t("file.lastOutput") }}</div>
        <div class="result-path" :title="pack.lastPack.value.outputPath">
          {{ pack.lastPack.value.outputPath }}
        </div>
        <div class="result-meta">
          {{
            $t("file.packMeta", {
              n: pack.lastPack.value.fileCount,
              size: pack.formatBytes(pack.lastPack.value.size),
              checksum: pack.lastPack.value.checksum
                .toString(16)
                .padStart(4, "0")
                .toUpperCase(),
            })
          }}
        </div>
        <div v-if="pack.packIndexSourceKey.value" class="result-index-src">
          {{ $t(pack.packIndexSourceKey.value) }}
        </div>
        <div class="result-actions">
          <a-button size="small" @click="pack.revealOutput()">
            {{ $t("file.revealOutput") }}
          </a-button>
          <a-button size="small" :loading="pack.probing.value" @click="pack.previewLastPackBin()">
            {{ $t("file.previewPackedIndex") }}
          </a-button>
        </div>
      </div>
    </section>

    <a-modal
      v-model:open="pack.indexModalOpen.value"
      :title="$t('file.indexModalTitle')"
      width="720px"
      :footer="null"
      destroy-on-close
    >
      <p class="index-hint">{{ $t("file.indexModalHint") }}</p>
      <pre class="index-json">{{ pack.indexJsonText.value }}</pre>
    </a-modal>

    <a-modal
      v-model:open="pack.manifestModalOpen.value"
      :title="$t('file.manifestModalTitle')"
      width="720px"
      :footer="null"
      destroy-on-close
    >
      <p class="index-hint">{{ $t(pack.manifestHintKey.value) }}</p>
      <pre class="index-json">{{ pack.manifestJsonText.value }}</pre>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { FolderOpenOutlined } from "@ant-design/icons-vue";
import { useI18n } from "vue-i18n";
import MenuIcon from "@/components/icons/MenuIcon.vue";
import { useTauriDragDrop } from "@/composables/useTauriDragDrop";
import { useMmapPack } from "./composables/useMmapPack";

const emit = defineEmits<{
  summary: [
    payload: {
      hasDir: boolean;
      done: boolean;
      dirName?: string;
      fileCount?: number;
    },
  ];
}>();

const { t, locale } = useI18n();
const pack = useMmapPack(emit);

/** tip 内文件说明按中文「；」或英文「;」分段 */
const dropFilesTipLines = computed(() => {
  const raw = t("file.dropFilesTip");
  const sep = locale.value.startsWith("zh") ? "；" : ";";
  return raw
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
});

useTauriDragDrop({
  onDrop: (paths) => {
    void pack.onDropPaths(paths);
  },
  onEnter: () => {
    pack.dragOver.value = true;
  },
  onLeave: () => {
    pack.dragOver.value = false;
  },
});

function onZoneClick() {
  if (!pack.hasDir.value && !pack.probing.value) {
    void pack.pickDir();
  }
}
</script>

<style scoped>
.workbench {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
  height: 100%;
  overflow: hidden;
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
  gap: 12px;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.panel-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.88);
}

.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 220px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
  border-style: dashed;
}

.drop-zone--over {
  border-color: rgba(149, 222, 100, 0.55);
  background: rgba(149, 222, 100, 0.08);
}

.drop-zone--filled {
  align-items: stretch;
  cursor: default;
  border-style: solid;
}

.drop-icon {
  display: inline-flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 22px;
  background: rgba(149, 222, 100, 0.14);
  color: #95de64;
}

.drop-title-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.drop-title {
  font-size: 15px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.tip-icon {
  display: inline-flex;
  width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 11px;
  line-height: 1;
  cursor: help;
  color: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.tip-icon:hover {
  color: #95de64;
  border-color: rgba(149, 222, 100, 0.55);
}

.drop-hint {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  text-align: center;
  max-width: 560px;
  line-height: 1.65;
}

.drop-tip-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drop-tip-body p {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
}

.drop-steps {
  margin: 0 0 4px;
  font-size: 12px;
  color: rgba(149, 222, 100, 0.9);
  text-align: center;
  max-width: 560px;
  line-height: 1.55;
}

.dir-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.dir-badge {
  display: inline-flex;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 26px;
  color: #95de64;
  background: linear-gradient(
    145deg,
    rgba(149, 222, 100, 0.22),
    rgba(149, 222, 100, 0.08)
  );
  border: 1px solid rgba(149, 222, 100, 0.28);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}

.dir-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dir-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.dir-meta {
  min-width: 0;
  flex: 1;
}

.dir-name {
  font-size: 15px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.92);
}

.dir-path {
  margin-top: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dir-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.dir-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dir-stat-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.dir-stat-pill--ok {
  color: #95de64;
  border-color: rgba(149, 222, 100, 0.35);
  background: rgba(149, 222, 100, 0.1);
}

.index-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.index-option-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.45);
  max-width: 640px;
}

.result-index-src {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.bin-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(149, 222, 100, 0.08);
  border: 1px solid rgba(149, 222, 100, 0.22);
}

.bin-banner-label {
  font-size: 12px;
  color: #95de64;
  flex-shrink: 0;
}

.bin-banner-path {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.file-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.list-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  border: 1px dashed rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 24px;
}

.list-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.list-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.list-rel {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.82);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.list-size {
  flex-shrink: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}

.error-box {
  margin-bottom: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255, 77, 79, 0.1);
  border: 1px solid rgba(255, 77, 79, 0.25);
}

.error-line {
  font-size: 12px;
  color: #ff7875;
  line-height: 1.4;
}

.pack-result {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.result-title {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

.result-path {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  word-break: break-all;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.result-meta {
  font-size: 11px;
  color: #95de64;
}

.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.index-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.55;
}

.index-json {
  margin: 0;
  max-height: 480px;
  overflow: auto;
  padding: 12px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.85);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: pre;
  user-select: text;
  -webkit-user-select: text;
  cursor: text;
}
</style>
