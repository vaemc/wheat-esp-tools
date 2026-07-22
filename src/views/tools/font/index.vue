<template>
  <div class="font-page">
    <aside class="font-sidebar panel">
      <header class="panel-head">
        <span class="panel-title">{{ $t("font.toolbox") }}</span>
      </header>

      <div class="tool-list">
        <button
          v-for="tool in FONT_CONVERTER_TOOLS"
          :key="tool.id"
          type="button"
          class="tool-item"
          :class="{ active: activeTool === tool.id }"
          @click="onSwitchTool(tool.id)"
        >
          <span class="tool-icon" :data-icon="tool.icon">
            <MenuIcon :name="tool.icon" />
          </span>
          <span class="tool-name">{{ $t(tool.labelKey) }}</span>
        </button>
      </div>

      <div class="history-block">
        <div class="history-head">
          <span class="history-title">{{ $t("font.historyTitle") }}</span>
          <a-button
            v-if="historyItems.length"
            type="link"
            size="small"
            class="history-clear"
            @click="historyStore.clearAll()"
          >
            {{ $t("font.historyClear") }}
          </a-button>
        </div>
        <p class="history-hint">{{ $t("font.historyHint") }}</p>

        <div v-if="historyItems.length === 0" class="history-empty">
          {{ $t("font.historyEmpty") }}
        </div>
        <div v-else class="history-list">
          <button
            v-for="item in historyItems"
            :key="item.path"
            type="button"
            class="history-item"
            :class="{ active: item.path === currentPath }"
            :title="item.path"
            @click="onUseHistory(item.path)"
          >
            <span class="history-name">{{ item.name }}</span>
            <span
              class="history-remove"
              :title="$t('font.historyRemove')"
              @click.stop="historyStore.removePath(item.path)"
            >
              ×
            </span>
          </button>
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
import { storeToRefs } from "pinia";
import MenuIcon from "@/components/icons/MenuIcon.vue";
import { useFontHistoryStore } from "@/stores/fontHistory";
import {
  FONT_CONVERTER_TOOLS,
  getFontConverterTool,
  type FontConverterId,
} from "./registry";

const activeTool = ref<FontConverterId>("lvglfont");
const summary = ref<{
  hasFont: boolean;
  done: boolean;
  fileName?: string;
  sourcePath?: string | null;
}>({ hasFont: false, done: false });

const historyStore = useFontHistoryStore();
const { items: historyItems } = storeToRefs(historyStore);

const activeToolDef = computed(() => getFontConverterTool(activeTool.value));
const currentPath = computed(() => summary.value.sourcePath ?? null);

function onSwitchTool(id: FontConverterId) {
  activeTool.value = id;
  summary.value = { hasFont: false, done: false };
}

function onSummary(payload: {
  hasFont: boolean;
  done: boolean;
  fileName?: string;
  sourcePath?: string | null;
}) {
  summary.value = payload;
}

function onUseHistory(path: string) {
  historyStore.usePath(path);
}
</script>

<style scoped>
.font-page {
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

.font-sidebar {
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
  border-color: rgba(250, 173, 20, 0.4);
  background: rgba(250, 173, 20, 0.06);
}

.tool-item.active {
  border-color: rgba(250, 173, 20, 0.55);
  background: rgba(250, 173, 20, 0.1);
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
  background: rgba(250, 173, 20, 0.14);
}

.tool-name {
  font-size: 13px;
  font-weight: 500;
  min-width: 0;
}

.history-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  flex: 1;
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.history-title {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.62);
}

.history-clear {
  padding: 0;
  height: auto;
  font-size: 11px;
}

.history-hint {
  margin: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  line-height: 1.4;
}

.history-empty {
  padding: 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px dashed rgba(255, 255, 255, 0.08);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  text-align: center;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: auto;
  min-height: 0;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.78);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.history-item:hover {
  border-color: rgba(250, 173, 20, 0.4);
  background: rgba(250, 173, 20, 0.08);
}

.history-item.active {
  border-color: rgba(250, 173, 20, 0.55);
  background: rgba(250, 173, 20, 0.12);
}

.history-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-remove {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
  color: rgba(255, 255, 255, 0.35);
}

.history-remove:hover {
  color: #ff7875;
  background: rgba(255, 77, 79, 0.15);
}
</style>
