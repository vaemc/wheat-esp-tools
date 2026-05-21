<template>
  <div class="firmware-page">
    <a-row :gutter="24" class="firmware-panels">
      <a-col :xs="24" :lg="12">
        <HistoryPathsPanel />
      </a-col>
      <a-col :xs="24" :lg="12">
        <LocalFirmwarePanel />
      </a-col>
    </a-row>
  </div>
</template>
<script setup lang="ts">
import HistoryPathsPanel from "./components/HistoryPathsPanel.vue";
import LocalFirmwarePanel from "./components/LocalFirmwarePanel.vue";
</script>
<style scoped>
.firmware-page {
  padding: 12px 16px;
}
.firmware-panels {
  margin-top: 8px;
}
:deep(.panel) {
  height: 100%;
  min-height: 360px;
}
:deep(.panel-head) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
:deep(.panel-title) {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.88);
}
:deep(.panel-meta) {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}
:deep(.panel-hint) {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.45);
}
:deep(.panel-search) {
  margin-bottom: 10px;
}
:deep(.panel-search .ant-input) {
  font-size: 13px;
}
:deep(.item-list) {
  max-height: 380px;
  overflow: auto;
}
:deep(.item-list .ant-list-item) {
  padding: 6px 12px !important;
}
:deep(.item-list .ant-list-item-meta) {
  margin-bottom: 0 !important;
}
:deep(.item-list .ant-list-item-meta-title) {
  margin-bottom: 0 !important;
  line-height: 1.4;
}
:deep(.item-list .ant-list-item-meta-description) {
  margin-top: 2px !important;
  line-height: 1.3;
}
:deep(.item-list .ant-list-item-action) {
  margin-inline-start: 8px !important;
}
:deep(.item-list .ant-list-item-action > li) {
  padding: 0 4px !important;
}
:deep(.item-list .ant-btn-link) {
  height: 24px;
  padding: 0 4px;
  font-size: 13px;
  line-height: 24px;
}
:deep(.item-list .ant-pagination) {
  margin: 6px 0 0 !important;
}
:deep(.item-list .ant-pagination-item),
:deep(.item-list .ant-pagination-prev),
:deep(.item-list .ant-pagination-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}
:deep(.item-title) {
  margin-left: 4px;
  font-size: 14px;
  font-weight: 500;
}
:deep(.type-tag) {
  margin: 0;
  padding: 0 5px;
  font-size: 11px;
  line-height: 18px;
  vertical-align: middle;
}
:deep(.item-path) {
  display: block;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:deep(.item-line) {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
:deep(.item-line .item-title) {
  flex-shrink: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:deep(.item-line .item-size) {
  flex-shrink: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}
:deep(.item-size) {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}
:deep(.open-dir-btn) {
  padding: 0;
  height: auto;
}
</style>
