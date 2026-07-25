<template>
  <div class="ble-page">
    <section class="ble-toolbar">
      <div class="toolbar-left">
        <a-segmented
          v-model:value="scanMode"
          :options="modeOptions"
          :disabled="isScanning || bleConn.connecting.value"
          @change="onModeChange"
        />
        <a-button
          type="primary"
          :danger="isScanning"
          :disabled="bleConn.connecting.value"
          @click="toggleScan"
        >
          {{ isScanning ? $t("ble.stopScanning") : $t("ble.startScanning") }}
        </a-button>
        <a-button
          :disabled="isScanning || bleConn.connecting.value"
          @click="clearDevices"
        >
          {{ $t("ble.clearList") }}
        </a-button>
      </div>
      <div class="stats">
        <span v-if="isScanning" class="live-pill">
          <span class="pulse" />
          {{ $t("ble.scanning") }}
        </span>
        <span v-if="bleConn.connected.value" class="live-pill ok">
          {{ $t("ble.connected") }}
        </span>
        <span class="stat-item">
          {{ $t("ble.deviceCount", { total: stats.total, visible: stats.visible }) }}
        </span>
        <span v-if="stats.strongest != null" class="stat-item">
          {{ $t("ble.strongest") }}
          <em :style="{ color: rssiColor(stats.strongest) }">
            {{ stats.strongest }} dBm
          </em>
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

    <div class="ble-layout" :class="{ classic: scanMode === 'classic' }">
      <section class="ble-list">
        <header class="list-head">
          <span>{{ $t("ble.deviceList") }}</span>
          <span class="list-sub">{{ $t("ble.tapForDetail") }}</span>
        </header>
        <BleDeviceTable
          v-if="scanMode === 'ble'"
          :devices="bleDevices"
          :empty-text="emptyText"
          :connecting-address="connectingAddress"
          :connected-address="bleConn.info.value?.address ?? null"
          @connect="onConnectDevice"
        />
        <ClassicBtDeviceTable
          v-else
          :devices="classicDevices"
          :empty-text="emptyText"
        />
      </section>

      <aside class="ble-side">
        <template v-if="scanMode === 'ble'">
          <BleGattPanel
            :connected="bleConn.connected.value"
            :busy="bleConn.busy.value"
            :info="bleConn.info.value"
            :logs="bleConn.logs.value"
            :last-counter="bleConn.lastCounter.value"
            :is-subscribed="bleConn.isSubscribed"
            @disconnect="bleConn.disconnect"
            @read="(s, c) => bleConn.read(s, c)"
            @write="(s, c, text) => bleConn.write(s, c, text)"
            @subscribe="(s, c) => bleConn.subscribe(s, c)"
            @unsubscribe="(s, c) => bleConn.unsubscribe(s, c)"
            @clear-logs="bleConn.clearLogs"
            @send-echo="onSendEcho"
          />
          <BleFilterPanel
            :filter="bleFilter"
            :reset-filter="resetBleFilter"
          />
        </template>
        <ClassicBtFilterPanel
          v-else
          :filter="classicFilter"
          :reset-filter="resetClassicFilter"
        />
      </aside>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import BleDeviceTable from "./components/BleDeviceTable.vue";
import ClassicBtDeviceTable from "./components/ClassicBtDeviceTable.vue";
import BleFilterPanel from "./components/BleFilterPanel.vue";
import ClassicBtFilterPanel from "./components/ClassicBtFilterPanel.vue";
import BleGattPanel from "./components/BleGattPanel.vue";
import { useBleScanner } from "./composables/useBleScanner";
import { useClassicBtScanner } from "./composables/useClassicBtScanner";
import { useBleConnection } from "./composables/useBleConnection";
import { rssiColor } from "./utils/bleFormat";
import type { BleDeviceRecord, BleScanMode } from "./types";

const { t } = useI18n();

const scanMode = ref<BleScanMode>("ble");
const connectingAddress = ref<string | null>(null);

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

const bleConn = useBleConnection();

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

async function onConnectDevice(record: BleDeviceRecord) {
  if (bleScanning.value) {
    await stopBleScan();
  }
  connectingAddress.value = record.address;
  try {
    await bleConn.connect(record.address, record.local_name || undefined);
  } finally {
    connectingAddress.value = null;
  }
}

async function onSendEcho(text: string) {
  try {
    await bleConn.runEspTestEcho(text);
  } catch {
    /* logged */
  }
}

onMounted(() => {
  setupBleListener();
  setupClassicListener();
});
</script>
<style scoped>
.ble-page {
  padding: 14px 16px 18px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.ble-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 14px;
  margin-bottom: 12px;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
}
.toolbar-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
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
  color: rgba(255, 255, 255, 0.5);
}
.stat-item em {
  font-style: normal;
  font-family: Consolas, "Courier New", monospace;
  font-weight: 600;
  margin-left: 4px;
}
.live-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 999px;
  color: #91caff;
  background: rgba(105, 177, 255, 0.12);
  border: 1px solid rgba(105, 177, 255, 0.22);
}
.live-pill.ok {
  color: #3ecf8e;
  background: rgba(62, 207, 142, 0.12);
  border-color: rgba(62, 207, 142, 0.22);
}
.pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #69b1ff;
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.35;
    transform: scale(0.75);
  }
}
.mode-hint {
  margin: -4px 0 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.42);
  flex-shrink: 0;
}
.ble-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.9fr);
  gap: 12px;
  align-items: stretch;
  flex: 1;
  min-height: 0;
}
.ble-layout.classic {
  grid-template-columns: minmax(0, 1.6fr) minmax(260px, 0.7fr);
}
.ble-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
}
.list-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px 8px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.88);
  flex-shrink: 0;
}
.list-sub {
  font-size: 11px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.35);
}
.ble-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: auto;
}
@media (max-width: 1100px) {
  .ble-layout,
  .ble-layout.classic {
    grid-template-columns: 1fr;
  }
  .ble-list {
    min-height: 360px;
  }
}
</style>
