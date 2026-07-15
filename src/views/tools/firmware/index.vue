<template>
  <div class="firmware-page">
    <section class="toolbar panel">
      <header class="toolbar-head">
        <div>
          <div class="toolbar-title">{{ $t("firmware.flashOption") }}</div>
          <p class="toolbar-hint">{{ $t("firmware.flashOptionHint") }}</p>
        </div>
      </header>
      <FlashOptionsBar
        v-model:baud-rate="baudRate"
        v-model:spi-mode="spiMode"
        v-model:erase-before-flash="eraseBeforeFlash"
      />
    </section>

    <div class="firmware-panels">
      <LocalFirmwarePanel
        v-model:baud-rate="baudRate"
        v-model:spi-mode="spiMode"
        v-model:erase-before-flash="eraseBeforeFlash"
      />
      <HistoryPathsPanel />
    </div>
  </div>
</template>
<script setup lang="ts">
import FlashOptionsBar from "./components/FlashOptionsBar.vue";
import HistoryPathsPanel from "./components/HistoryPathsPanel.vue";
import LocalFirmwarePanel from "./components/LocalFirmwarePanel.vue";
import { useFlashOptions } from "@/composables/useFlashOptions";

const { baudRate, spiMode, eraseBeforeFlash } = useFlashOptions();
</script>
<style scoped>
.firmware-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  padding: 12px 16px;
}

.panel {
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

.toolbar {
  flex-shrink: 0;
}

.toolbar-head {
  margin-bottom: 10px;
}

.toolbar-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.88);
}

.toolbar-hint {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.45);
}

.firmware-panels {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

@media (max-width: 1100px) {
  .firmware-panels {
    grid-template-columns: 1fr;
    overflow: auto;
  }
}

.firmware-page :deep(.panel-body) {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  overflow: hidden;
}

.firmware-page :deep(.panel-head) {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  margin-bottom: 10px;
}

.firmware-page :deep(.panel-head-text) {
  min-width: 0;
}

.firmware-page :deep(.panel-title-row) {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.firmware-page :deep(.panel-title) {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.88);
}

.firmware-page :deep(.panel-meta) {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.firmware-page :deep(.panel-hint) {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.45);
}

.firmware-page :deep(.panel-actions) {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.firmware-page :deep(.panel-search) {
  flex-shrink: 0;
  margin-bottom: 10px;
}

.firmware-page :deep(.panel-search .ant-input) {
  font-size: 13px;
}

.firmware-page :deep(.item-scroll) {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.firmware-page :deep(.item-stack) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.firmware-page :deep(.fw-item) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  transition: border-color 0.15s ease, background 0.15s ease;
}

.firmware-page :deep(.fw-item:hover) {
  border-color: rgba(56, 189, 248, 0.28);
  background: rgba(56, 189, 248, 0.04);
}

.firmware-page :deep(.fw-item-main) {
  min-width: 0;
  flex: 1;
}

.firmware-page :deep(.fw-item-title-row) {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.firmware-page :deep(.fw-item-title) {
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.88);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.firmware-page :deep(.fw-item-path),
.firmware-page :deep(.fw-item-size) {
  margin-top: 3px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.firmware-page :deep(.fw-item-actions) {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.firmware-page :deep(.type-tag) {
  margin: 0;
  padding: 0 6px;
  font-size: 11px;
  line-height: 18px;
}

.firmware-page :deep(.firmware-empty) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 180px;
  padding: 16px;
}

.firmware-page :deep(.firmware-empty .placeholder-hint) {
  margin: 0;
}

.firmware-page :deep(.panel-pagination) {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
</style>
