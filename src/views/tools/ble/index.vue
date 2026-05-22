<template>
  <div class="ble-page">
    <section class="ble-toolbar panel">
      <a-button
        type="primary"
        :danger="scanning"
        :loading="false"
        @click="toggleScan"
      >
        {{ scanning ? $t("ble.stopScanning") : $t("ble.startScanning") }}
      </a-button>
      <a-button :disabled="scanning" @click="clearDevices">
        {{ $t("ble.clearList") }}
      </a-button>
      <div class="stats">
        <a-tag color="processing" v-if="scanning">{{ $t("ble.scanning") }}</a-tag>
        <span class="stat-item">
          {{ $t("ble.deviceCount", { total: stats.total, visible: stats.visible }) }}
        </span>
        <span v-if="stats.strongest != null" class="stat-item">
          {{ $t("ble.strongest") }}: {{ stats.strongest }} dBm
        </span>
      </div>
    </section>

    <a-row :gutter="16" class="ble-body">
      <a-col :xs="24" :lg="17">
        <section class="ble-list panel">
          <BleDeviceTable
            :devices="filteredDevices"
            :empty-text="emptyText"
            :table-height="tableHeight"
          />
        </section>
      </a-col>
      <a-col :xs="24" :lg="7">
        <BleFilterPanel :filter="filter" :reset-filter="resetFilter" />
      </a-col>
    </a-row>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import BleDeviceTable from "./components/BleDeviceTable.vue";
import BleFilterPanel from "./components/BleFilterPanel.vue";
import { useBleScanner } from "./composables/useBleScanner";

const { t } = useI18n();

const {
  scanning,
  filter,
  filteredDevices,
  stats,
  resetFilter,
  clearDevices,
  toggleScan,
  setupListener,
} = useBleScanner();

const tableHeight = 480;

const emptyText = computed(() =>
  scanning.value ? t("ble.emptyScanning") : t("ble.emptyIdle")
);

onMounted(() => {
  setupListener();
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
