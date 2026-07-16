<template>
  <div class="image-page">
    <aside class="image-sidebar panel">
      <header class="panel-head">
        <span class="panel-title">{{ $t("image.toolbox") }}</span>
      </header>

      <div class="tool-list">
        <button
          v-for="tool in IMAGE_CONVERTER_TOOLS"
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

      <div v-if="summary.count > 0" class="file-card">
        <div class="file-card-title">{{ $t("image.batchSummary") }}</div>
        <div class="file-card-name">
          {{ $t("image.batchCount", { n: summary.count }) }}
        </div>
        <div v-if="summary.done > 0" class="file-card-meta">
          {{ $t("image.batchDone", { n: summary.done }) }}
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
  IMAGE_CONVERTER_TOOLS,
  getImageConverterTool,
  type ImageConverterId,
} from "./registry";

const activeTool = ref<ImageConverterId>("sjpg");
const summary = ref({ count: 0, done: 0 });

const activeToolDef = computed(() => getImageConverterTool(activeTool.value));

function onSwitchTool(id: ImageConverterId) {
  activeTool.value = id;
  summary.value = { count: 0, done: 0 };
}

function onSummary(payload: { count: number; done: number }) {
  summary.value = payload;
}
</script>

<style scoped>
.image-page {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 300px;
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

.image-sidebar {
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
  border-color: rgba(125, 211, 252, 0.35);
  background: rgba(56, 189, 248, 0.06);
}

.tool-item.active {
  border-color: rgba(56, 189, 248, 0.55);
  background: rgba(56, 189, 248, 0.1);
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

.tool-icon[data-icon="sjpg"] {
  --icon-tint: rgba(255, 133, 192, 0.14);
}

.tool-icon[data-icon="eaf"] {
  --icon-tint: rgba(179, 127, 235, 0.14);
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
}

.file-card-meta {
  margin-top: 4px;
  font-size: 11px;
  color: #95de64;
}
</style>
