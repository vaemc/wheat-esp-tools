<template>
  <div class="ble-page">
    <section class="ble-toolbar panel">
      <a-segmented
        v-model:value="scanMode"
        :options="modeOptions"
        :disabled="isScanning"
        @change="onModeChange"
      />
      <a-button
        type="primary"
        :danger="isScanning"
        :loading="false"
        @click="toggleScan"
      >
        {{ isScanning ? $t("ble.stopScanning") : $t("ble.startScanning") }}
      </a-button>
      <a-button :disabled="isScanning" @click="clearDevices">
        {{ $t("ble.clearList") }}
      </a-button>
      <div class="stats">
        <a-tag color="processing" v-if="isScanning">{{ $t("ble.scanning") }}</a-tag>
        <span class="stat-item">
          {{ $t("ble.deviceCount", { total: stats.total, visible: stats.visible }) }}
        </span>
        <span v-if="stats.strongest != null" class="stat-item">
          {{ $t("ble.strongest") }}: {{ stats.strongest }} dBm
        </span>
        <template v-if="scanMode === 'classic'">
          <span v-if="classicStats.paired > 0" class="stat-item">
            {{ $t("ble.classicPaired") }}: {{ classicStats.paired }}
          </span>
          <span v-if="classicStats.connected > 0" class="stat-item">
            {{ $t("ble.classicConnected") }}: {{ classicStats.connected }}
          </span>
        </template>
      </div>
    </section>

    <p v-if="scanMode === 'classic'" class="mode-hint">
      {{ $t("ble.classicHint") }}
    </p>

    <a-row :gutter="16" class="ble-body">
      <a-col :xs="24" :lg="17">
        <section class="ble-list panel">
          <BleDeviceTable
            v-if="scanMode === 'ble'"
            :devices="bleDevices"
            :empty-text="emptyText"
            :table-height="tableHeight"
          />
          <ClassicBtDeviceTable
            v-else
            :devices="classicDevices"
            :empty-text="emptyText"
            :table-height="tableHeight"
          />
        </section>
      </a-col>
      <a-col :xs="24" :lg="7">
        <BleFilterPanel
          v-if="scanMode === 'ble'"
          :filter="bleFilter"
          :reset-filter="resetBleFilter"
        />
        <ClassicBtFilterPanel
          v-else
          :filter="classicFilter"
          :reset-filter="resetClassicFilter"
        />
      </a-col>
    </a-row>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import BleDeviceTable from "./components/BleDeviceTable.vue";
import ClassicBtDeviceTable from "./components/ClassicBtDeviceTable.vue";
import BleFilterPanel from "./components/BleFilterPanel.vue";
import ClassicBtFilterPanel from "./components/ClassicBtFilterPanel.vue";
import { useBleScanner } from "./composables/useBleScanner";
import { useClassicBtScanner } from "./composables/useClassicBtScanner";
import type { BleScanMode } from "./types";

const { t } = useI18n();

const scanMode = ref<BleScanMode>("ble");

const {
  scanning: bleScanning,
  filter: bleFilter,
  filteredDevices: bleDevices,
  stats: bleStats,
  resetFilter: resetBleFilter,
  clearDevices: clearBleDevices,
  toggleScan: toggleBleScan,
  stopScan: stopBleScan,
  setupListener: setupBleListener,
} = useBleScanner();

const {
  scanning: classicScanning,
  filter: classicFilter,
  filteredDevices: classicDevices,
  stats: classicStats,
  resetFilter: resetClassicFilter,
  clearDevices: clearClassicDevices,
  toggleScan: toggleClassicScan,
  stopScan: stopClassicScan,
  setupListener: setupClassicListener,
} = useClassicBtScanner();

const modeOptions = computed(() => [
  { label: t("ble.modeBle"), value: "ble" },
  { label: t("ble.modeClassic"), value: "classic" },
]);

const isScanning = computed(
  () =>
    (scanMode.value === "ble" && bleScanning.value) ||
    (scanMode.value === "classic" && classicScanning.value)
);

const stats = computed(() =>
  scanMode.value === "ble" ? bleStats.value : classicStats.value
);

const tableHeight = 480;

const emptyText = computed(() => {
  if (isScanning.value) {
    return scanMode.value === "ble"
      ? t("ble.emptyScanning")
      : t("ble.classicEmptyScanning");
  }
  return scanMode.value === "ble"
    ? t("ble.emptyIdle")
    : t("ble.classicEmptyIdle");
});

async function toggleScan() {
  if (scanMode.value === "ble") {
    await toggleBleScan();
  } else {
    await toggleClassicScan();
  }
}

function clearDevices() {
  if (scanMode.value === "ble") {
    clearBleDevices();
  } else {
    clearClassicDevices();
  }
}

async function onModeChange() {
  if (bleScanning.value) {
    await stopBleScan();
  }
  if (classicScanning.value) {
    await stopClassicScan();
  }
}

onMounted(() => {
  setupBleListener();
  setupClassicListener();
});
</script>
<style scoped>
.ble-page {
  padding: 12px 16px;
}
.panel {
  margin-bottom: 12px;
}
.ble-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 12px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
}
.stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-left: auto;
}
.stat-item {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}
.mode-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}
.ble-list {
  padding: 0;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
}
.ble-list :deep(.ble-table) {
  padding: 4px 6px;
}
.ble-body {
  margin-top: 0;
}
</style>
