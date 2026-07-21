<template>
  <div class="file-page">
    <aside class="file-sidebar panel">
      <header class="panel-head">
        <span class="panel-title">{{ $t("file.toolbox") }}</span>
      </header>

      <div class="tool-list">
        <button
          v-for="tool in FILE_CONVERTER_TOOLS"
          :key="tool.id"
          type="button"
          class="tool-item"
          :class="{ active: activeTool === tool.id }"
          @click="onSwitchTool(tool.id)"
        >
          <span class="tool-icon" :data-icon="tool.icon">
            <MenuIcon :name="tool.icon" />
          </span>
          <span class="tool-text">
            <span class="tool-name">{{ $t(tool.labelKey) }}</span>
          </span>
        </button>
      </div>

      <div v-if="summary.hasDir" class="file-card">
        <div class="file-card-title">{{ $t("file.batchSummary") }}</div>
        <div class="file-card-name" :title="summary.dirName">
          {{ summary.dirName }}
        </div>
        <div v-if="summary.fileCount > 0" class="file-card-meta">
          {{ $t("file.batchCount", { n: summary.fileCount }) }}
        </div>
        <div v-if="summary.done" class="file-card-done">
          {{ $t("file.packDone") }}
        </div>
      </div>
    </aside>

    <component
      :is="activeToolDef?.component"
      :key="activeTool"
      @summary="onSummary"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import MenuIcon from "@/components/icons/MenuIcon.vue";
import {
  FILE_CONVERTER_TOOLS,
  getFileConverterTool,
  type FileConverterId,
} from "./registry";

const activeTool = ref<FileConverterId>("mmap_spiffs");
const summary = ref({
  hasDir: false,
  done: false,
  dirName: "",
  fileCount: 0,
});

const activeToolDef = computed(() => getFileConverterTool(activeTool.value));

function onSwitchTool(id: FileConverterId) {
  activeTool.value = id;
  summary.value = { hasDir: false, done: false, dirName: "", fileCount: 0 };
}

function onSummary(payload: {
  hasDir: boolean;
  done: boolean;
  dirName?: string;
  fileCount?: number;
}) {
  summary.value = {
    hasDir: payload.hasDir,
    done: payload.done,
    dirName: payload.dirName ?? "",
    fileCount: payload.fileCount ?? 0,
  };
}
</script>

<style scoped>
.file-page {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 12px;
  height: 100%;
  min-height: 520px;
  padding: 12px 16px;
  box-sizing: border-box;
  overflow: hidden;
  align-items: stretch;
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

.file-sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
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

.tool-item:hover {
  border-color: rgba(149, 222, 100, 0.4);
  background: rgba(149, 222, 100, 0.06);
}

.tool-item.active {
  border-color: rgba(149, 222, 100, 0.55);
  background: rgba(149, 222, 100, 0.1);
}

.tool-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  font-size: 15px;
  line-height: 1;
  flex-shrink: 0;
  background: var(--icon-tint, rgba(255, 255, 255, 0.06));
}

.tool-icon[data-icon="mmap_spiffs"] {
  --icon-tint: rgba(149, 222, 100, 0.14);
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-card-meta {
  margin-top: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
}

.file-card-done {
  margin-top: 4px;
  font-size: 11px;
  color: #95de64;
}
</style>
