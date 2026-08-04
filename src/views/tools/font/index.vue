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
          @click="activeTool = tool.id"
        >
          <span class="tool-icon" :data-icon="tool.icon">
            <MenuIcon :name="tool.icon" />
          </span>
          <span class="tool-name">{{ $t(tool.labelKey) }}</span>
        </button>
      </div>
    </aside>

    <KeepAlive :max="FONT_CONVERTER_TOOLS.length">
      <component :is="activeToolDef?.component" :key="activeTool" />
    </KeepAlive>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import MenuIcon from "@/components/icons/MenuIcon.vue";
import {
  FONT_CONVERTER_TOOLS,
  getFontConverterTool,
  type FontConverterId,
} from "./registry";

const activeTool = ref<FontConverterId>("lvglfont");
const activeToolDef = computed(() => getFontConverterTool(activeTool.value));
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
</style>
