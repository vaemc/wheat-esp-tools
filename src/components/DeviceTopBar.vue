<template>
  <div class="device-top-bar">
    <div class="bar-section bar-port">
      <a-select
        v-model:value="port"
        class="port-select"
        :placeholder="$t('device.selectPort')"
        :loading="store.loadingPorts"
        :options="store.portOptions"
        allow-clear
        show-search
        :filter-option="filterPort"
        @dropdown-visible-change="onDropdownOpen"
        @change="onPortChange"
      />
      <a-tooltip :title="$t('device.refresh')">
        <a-button
          type="text"
          class="icon-btn"
          :disabled="!store.port"
          :loading="store.loadingInfo"
          @click="store.refreshDeviceInfo()"
        >
          <ReloadOutlined />
        </a-button>
      </a-tooltip>
    </div>

    <a-divider type="vertical" class="bar-divider" />

    <a-spin :spinning="store.loadingInfo" class="bar-stats-spin">
      <div v-if="primaryItems.length" class="bar-stats">
        <div
          v-for="item in primaryItems"
          :key="item.key"
          class="stat-pill"
          :class="`stat-pill--${item.key}`"
        >
          <span class="stat-label">{{ item.label }}</span>
          <p v-if="item.copy" v-copy class="stat-value stat-value--mono stat-value--copy">
            {{ item.value }}
          </p>
          <span
            v-else
            class="stat-value"
            :class="{ 'stat-value--mono': item.mono }"
          >
            {{ item.value }}
          </span>
        </div>

        <a-popover
          v-if="extraItems.length"
          placement="bottomLeft"
          trigger="click"
          overlay-class-name="device-more-popover"
        >
          <template #content>
            <div class="more-panel">
              <div
                v-for="item in allItems"
                :key="item.key"
                class="more-row"
              >
                <span class="more-label">{{ item.label }}</span>
                <p v-if="item.copy" v-copy class="more-value more-value--mono">
                  {{ item.value }}
                </p>
                <span
                  v-else
                  class="more-value"
                  :class="{ 'more-value--mono': item.mono }"
                >
                  {{ item.value }}
                </span>
              </div>
            </div>
          </template>
          <a-button type="text" class="more-btn">
            {{ $t("device.more") }}
            <DownOutlined class="more-btn-icon" />
          </a-button>
        </a-popover>
      </div>
      <span v-else class="bar-placeholder">
        {{
          store.port ? $t("device.noInfo") : $t("device.selectPortHint")
        }}
      </span>
    </a-spin>
  </div>
</template>
<script setup lang="ts">
import { onMounted } from "vue";
import { ReloadOutlined, DownOutlined } from "@ant-design/icons-vue";
import { useDeviceInfoDisplay } from "@/composables/useDeviceInfoDisplay";

const { store, port, allItems, primaryItems, extraItems } =
  useDeviceInfoDisplay();

function filterPort(input: string, option?: { label?: string; value?: string }) {
  const label = option?.label ?? option?.value ?? "";
  return label.toLowerCase().includes(input.toLowerCase());
}

function onDropdownOpen(open: boolean) {
  if (open) {
    store.refreshPortList();
  }
}

function onPortChange(value: string | undefined) {
  if (value) {
    store.setPort(value);
  } else {
    store.clearPort();
  }
}

onMounted(() => {
  store.refreshPortList();
});
</script>
<style scoped>
.device-top-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 52px;
  padding: 8px 16px;
  background: linear-gradient(
    180deg,
    rgba(36, 36, 36, 0.98) 0%,
    rgba(22, 22, 22, 0.96) 100%
  );
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.35);
}
.bar-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.bar-port {
  min-width: 200px;
}
.port-select {
  width: 168px;
}
.port-select :deep(.ant-select-selector) {
  background: rgba(0, 0, 0, 0.28) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
}
.icon-btn {
  color: rgba(255, 255, 255, 0.55);
  width: 32px;
  height: 32px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.icon-btn:hover:not(:disabled) {
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.06);
}
.bar-divider {
  height: 28px;
  margin: 0;
  border-color: rgba(255, 255, 255, 0.12);
  flex-shrink: 0;
}
.bar-stats-spin {
  flex: 1;
  min-width: 0;
}
.bar-stats-spin :deep(.ant-spin-container) {
  display: flex;
  align-items: center;
  min-height: 36px;
}
.bar-stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 280px;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.stat-pill--chip {
  border-color: rgba(22, 119, 255, 0.35);
  background: rgba(22, 119, 255, 0.12);
}
.stat-pill--mac {
  border-color: rgba(82, 196, 26, 0.35);
  background: rgba(82, 196, 26, 0.1);
}
.stat-pill--flash {
  border-color: rgba(250, 173, 20, 0.35);
  background: rgba(250, 173, 20, 0.1);
}
.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
}
.stat-value {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.92);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stat-value--mono {
  font-family: Consolas, "Courier New", monospace;
  font-size: 11px;
}
.stat-value--copy {
  margin: 0;
  cursor: pointer;
}
.more-btn {
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}
.more-btn:hover {
  color: rgba(255, 255, 255, 0.88);
  background: rgba(255, 255, 255, 0.06);
}
.more-btn-icon {
  font-size: 10px;
  margin-left: 2px;
}
.bar-placeholder {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.38);
}
</style>
<style>
.device-more-popover .ant-popover-inner {
  background: #1f1f1f;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.device-more-popover .more-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 280px;
  max-width: 420px;
  max-height: 320px;
  overflow-y: auto;
}
.device-more-popover .more-row {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 8px;
  align-items: start;
}
.device-more-popover .more-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}
.device-more-popover .more-value {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  word-break: break-word;
  margin: 0;
}
.device-more-popover .more-value--mono {
  font-family: Consolas, "Courier New", monospace;
  font-size: 11px;
}
</style>
