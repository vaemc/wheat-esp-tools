<template>
  <a-table
    class="ble-table"
    :bordered="true"
    :pagination="false"
    size="small"
    row-key="address"
    :scroll="{ y: tableHeight }"
    :data-source="devices"
    :columns="columns"
    :locale="{ emptyText: emptyText }"
    :expanded-row-keys="expandedKeys"
    @expand="onExpand"
  >
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'rssi'">
        <span class="rssi-text" :style="{ color: rssiColor(record.rssi) }">
          {{ record.rssi }}
        </span>
      </template>
      <template v-else-if="column.key === 'name'">
        <span class="device-name">
          {{ displayName(record.local_name, $t("ble.unknownName")) }}
        </span>
      </template>
      <template v-else-if="column.key === 'address'">
        <p v-copy class="mono addr">{{ record.address }}</p>
      </template>
      <template v-else-if="column.key === 'services'">
        <span v-if="record.services.length" class="svc-inline">
          {{ formatServicesShort(record.services) }}
        </span>
        <span v-else class="muted">—</span>
      </template>
      <template v-else-if="column.key === 'lastSeen'">
        <span class="seen-text">{{ formatAgoShort(record.lastSeen) }}</span>
      </template>
    </template>

    <template #expandedRowRender="{ record }">
      <div class="detail-panel">
        <div v-if="mfgRows(record).length" class="detail-block">
          <div class="detail-label">{{ $t("ble.manufacturer") }}</div>
          <div
            v-for="row in mfgRows(record)"
            :key="row.id"
            class="detail-row"
          >
            <span class="detail-key">{{ row.label }}</span>
            <code class="detail-val">{{ row.hex }}</code>
          </div>
        </div>

        <div v-if="record.services.length" class="detail-block">
          <div class="detail-label">{{ $t("ble.services") }}</div>
          <a-space wrap :size="4">
            <a-tag
              v-for="svc in record.services"
              :key="svc"
              color="geekblue"
              class="mono"
            >
              {{ svc }}
            </a-tag>
          </a-space>
        </div>

        <div v-if="svcDataRows(record).length" class="detail-block">
          <div class="detail-label">{{ $t("ble.serviceData") }}</div>
          <div
            v-for="row in svcDataRows(record)"
            :key="row.uuid"
            class="detail-row"
          >
            <span class="detail-key mono">{{ row.uuid }}</span>
            <code class="detail-val">{{ row.hex }}</code>
          </div>
        </div>

        <div v-if="record.adv.length" class="detail-block">
          <div class="detail-label">{{ $t("ble.rawAdv") }}</div>
          <code class="detail-val block">{{ bytesToHex(record.adv) }}</code>
        </div>

        <div class="detail-meta">
          {{ $t("ble.seenCount", { n: record.seenCount }) }}
        </div>
      </div>
    </template>
  </a-table>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { BleDeviceRecord } from "../types";
import {
  bytesToHex,
  displayName,
  formatManufacturerId,
  rssiColor,
  secondsSince,
} from "../utils/bleFormat";

const props = defineProps<{
  devices: BleDeviceRecord[];
  emptyText: string;
  tableHeight: number;
}>();

const { t } = useI18n();
const expandedKeys = ref<string[]>([]);

const columns = computed(() => [
  { title: t("ble.colRssi"), key: "rssi", width: 52, align: "center" as const },
  { title: t("ble.colName"), key: "name", width: 108, ellipsis: true },
  { title: "MAC", key: "address", width: 128, ellipsis: true },
  { title: t("ble.colServices"), key: "services", ellipsis: true },
  { title: t("ble.colLastSeen"), key: "lastSeen", width: 44, align: "right" as const },
]);

function shortUuid(uuid: string): string {
  const u = uuid.replace(/^0x/i, "").toUpperCase();
  if (u.length <= 8) {
    return `0x${u}`;
  }
  return `0x${u.slice(0, 4)}…${u.slice(-4)}`;
}

function formatAgoShort(lastSeen: number): string {
  const sec = secondsSince(lastSeen);
  return sec <= 0 ? "0s" : `${sec}s`;
}

function formatServicesShort(services: string[]): string {
  if (services.length === 0) {
    return "—";
  }
  const head = services.slice(0, 2).map(shortUuid).join(" ");
  return services.length > 2 ? `${head} +${services.length - 2}` : head;
}

function mfgRows(record: BleDeviceRecord) {
  return Object.entries(record.manufacturer_data).map(([id, bytes]) => ({
    id,
    label: formatManufacturerId(id),
    hex: bytesToHex(bytes),
  }));
}

function svcDataRows(record: BleDeviceRecord) {
  return Object.entries(record.service_data).map(([uuid, bytes]) => ({
    uuid,
    hex: bytesToHex(bytes),
  }));
}

function onExpand(expanded: boolean, record: BleDeviceRecord) {
  if (expanded) {
    expandedKeys.value = [record.address];
  } else {
    expandedKeys.value = [];
  }
}
</script>
<style scoped>
.ble-table :deep(.ant-table) {
  background: transparent;
  font-size: 12px;
}
.ble-table :deep(.ant-table-thead > tr > th) {
  padding: 4px 6px !important;
  font-size: 11px;
  font-weight: 500;
}
.ble-table :deep(.ant-table-tbody > tr > td) {
  padding: 2px 6px !important;
  line-height: 1.25;
}
.ble-table :deep(.ant-table-row-expand-icon-cell) {
  width: 28px !important;
  padding: 2px 4px !important;
}
.ble-table :deep(.ant-table-expanded-row > td) {
  padding: 4px 6px 6px !important;
}
.rssi-text {
  font-family: Consolas, "Courier New", monospace;
  font-size: 11px;
  font-weight: 600;
}
.device-name {
  font-size: 12px;
  font-weight: 500;
}
.mono {
  font-family: Consolas, "Courier New", monospace;
  font-size: 11px;
}
.addr {
  margin: 0;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.85);
}
.svc-inline {
  font-family: Consolas, "Courier New", monospace;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.65);
}
.muted {
  color: rgba(255, 255, 255, 0.35);
  font-size: 11px;
}
.seen-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-variant-numeric: tabular-nums;
}
.detail-panel {
  padding: 4px 2px 2px;
}
.detail-block {
  margin-bottom: 8px;
}
.detail-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  margin-bottom: 4px;
}
.detail-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 6px;
  margin-bottom: 4px;
  align-items: start;
}
.detail-key {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}
.detail-val {
  font-family: Consolas, "Courier New", monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.9);
  word-break: break-all;
}
.detail-val.block {
  display: block;
  padding: 4px 6px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 4px;
}
.detail-meta {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.38);
}
</style>
