<template>
  <section class="ble-filter panel">
    <header class="panel-head">
      <span class="panel-title">{{ $t("ble.filter") }}</span>
      <a-button type="link" size="small" @click="resetFilter">
        {{ $t("ble.reset") }}
      </a-button>
    </header>

    <a-form layout="vertical" class="filter-form">
      <a-form-item :label="$t('ble.name')">
        <a-input
          v-model:value="filter.name"
          allow-clear
          :placeholder="$t('ble.namePlaceholder')"
        />
      </a-form-item>
      <a-form-item label="MAC">
        <a-input
          v-model:value="filter.address"
          allow-clear
          class="mono"
          placeholder="AA:BB:CC:DD:EE:FF"
        />
      </a-form-item>
      <a-form-item>
        <a-checkbox v-model:checked="filter.pairedOnly">
          {{ $t("ble.classicPairedOnly") }}
        </a-checkbox>
      </a-form-item>
      <a-form-item>
        <a-checkbox v-model:checked="filter.connectedOnly">
          {{ $t("ble.classicConnectedOnly") }}
        </a-checkbox>
      </a-form-item>
      <a-form-item :label="$t('ble.rssiMin')">
        <div class="rssi-row">
          <a-tag :color="rssiColor(filter.rssiMin)">
            {{ filter.rssiMin }} dBm
          </a-tag>
          <span class="rssi-hint">{{ $t("ble.rssiMinHint") }}</span>
        </div>
        <a-slider
          v-model:value="filter.rssiMin"
          :min="-100"
          :max="-30"
          :tooltip-formatter="(v: number) => `${v} dBm`"
        />
      </a-form-item>
    </a-form>
  </section>
</template>
<script setup lang="ts">
import type { ClassicBtFilterState } from "../types";
import { rssiColor } from "../utils/bleFormat";

defineProps<{
  filter: ClassicBtFilterState;
  resetFilter: () => void;
}>();
</script>
<style scoped>
.ble-filter {
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.panel-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.88);
}
.filter-form :deep(.ant-form-item) {
  margin-bottom: 10px;
}
.filter-form :deep(.ant-form-item-label > label) {
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
}
.mono :deep(input) {
  font-family: Consolas, "Courier New", monospace;
  font-size: 12px;
}
.rssi-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.rssi-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.38);
}
</style>
