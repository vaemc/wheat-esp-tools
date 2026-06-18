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
    :expanded-row-keys="expandedKeys"
    @expand="onExpand"
  >
    <template #emptyText>
      <PlaceholderHint :text="emptyText" />
    </template>
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'rssi'">
        <span
          v-if="record.rssi != null"
          class="rssi-text"
          :style="{ color: rssiColor(record.rssi) }"
        >
          {{ record.rssi }}
        </span>
        <span v-else class="muted">{{ $t("ble.classicRssiUnknown") }}</span>
      </template>
      <template v-else-if="column.key === 'name'">
        <span
          class="device-name"
          :title="displayName(record.local_name, $t('ble.unknownName'))"
        >
          {{ displayName(record.local_name, $t("ble.unknownName")) }}
        </span>
      </template>
      <template v-else-if="column.key === 'address'">
        <p v-copy class="mono addr">{{ record.address }}</p>
      </template>
      <template v-else-if="column.key === 'class'">
        <span class="class-cell">
          <span class="mono">{{ record.class_of_device }}</span>
          <span class="class-tag">{{ record.class_category }}</span>
        </span>
      </template>
      <template v-else-if="column.key === 'status'">
        <a-space :size="4" wrap>
          <a-tag v-if="record.connected" color="green">
            {{ $t("ble.classicConnected") }}
          </a-tag>
          <a-tag v-if="record.paired" color="blue">
            {{ $t("ble.classicPaired") }}
          </a-tag>
          <a-tag v-if="record.authenticated" color="geekblue">
            {{ $t("ble.classicAuthenticated") }}
          </a-tag>
          <span
            v-if="!record.connected && !record.paired && !record.authenticated"
            class="muted"
          >
            —
          </span>
        </a-space>
      </template>
      <template v-else-if="column.key === 'lastSeen'">
        <span class="seen-text">{{ formatAgoShort(record.lastSeen, tick) }}</span>
      </template>
    </template>

    <template #expandedRowRender="{ record }">
      <div class="detail-panel">
        <div class="detail-block">
          <div class="detail-label">{{ $t("ble.classicClassOfDevice") }}</div>
          <div class="detail-row">
            <span class="detail-key">{{ $t("ble.classicCod") }}</span>
            <code class="detail-val mono">{{ record.class_of_device }}</code>
          </div>
          <div class="detail-row">
            <span class="detail-key">{{ $t("ble.classicCategory") }}</span>
            <span class="detail-val">{{ record.class_category }}</span>
          </div>
        </div>

        <div class="detail-block">
          <div class="detail-label">{{ $t("ble.colRssi") }}</div>
          <div class="detail-row">
            <span class="detail-key">{{ $t("ble.colRssi") }}</span>
            <span class="detail-val">
              {{
                record.rssi != null
                  ? `${record.rssi} dBm`
                  : $t("ble.classicRssiUnknown")
              }}
            </span>
          </div>
        </div>

        <div class="detail-block">
          <div class="detail-label">{{ $t("ble.classicLinkState") }}</div>
          <div class="detail-row">
            <span class="detail-key">{{ $t("ble.classicConnected") }}</span>
            <span class="detail-val">{{ yesNo(record.connected) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-key">{{ $t("ble.classicPaired") }}</span>
            <span class="detail-val">{{ yesNo(record.paired) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-key">{{ $t("ble.classicAuthenticated") }}</span>
            <span class="detail-val">{{ yesNo(record.authenticated) }}</span>
          </div>
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
import type { ClassicBtDeviceRecord } from "../types";
import PlaceholderHint from "@/components/PlaceholderHint.vue";
import { useRelativeTimeTick } from "../composables/useRelativeTimeTick";
import { displayName, rssiColor, secondsSince } from "../utils/bleFormat";

defineProps<{
  devices: ClassicBtDeviceRecord[];
  emptyText: string;
  tableHeight: number;
}>();

const { t } = useI18n();
const expandedKeys = ref<string[]>([]);
const tick = useRelativeTimeTick();

const columns = computed(() => [
  { title: t("ble.colRssi"), key: "rssi", width: 52, align: "center" as const },
  { title: t("ble.colName"), key: "name", minWidth: 96, ellipsis: true },
  { title: "MAC", key: "address", width: 128, ellipsis: true },
  { title: t("ble.classicColClass"), key: "class", ellipsis: true },
  { title: t("ble.classicColStatus"), key: "status", width: 140 },
  { title: t("ble.colLastSeen"), key: "lastSeen", width: 72, align: "right" as const },
]);

function formatAgoShort(lastSeen: number, _tick: number): string {
  void _tick;
  const sec = secondsSince(lastSeen);
  if (sec <= 0) {
    return t("ble.justNow");
  }
  return t("ble.secondsAgo", { n: sec });
}

function yesNo(v: boolean): string {
  return v ? t("ble.classicYes") : t("ble.classicNo");
}

function onExpand(expanded: boolean, record: ClassicBtDeviceRecord) {
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
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
.class-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.class-tag {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.55);
}
.muted {
  color: rgba(255, 255, 255, 0.35);
  font-size: 11px;
}
.seen-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
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
  grid-template-columns: 120px 1fr;
  gap: 6px;
  margin-bottom: 4px;
  align-items: start;
}
.detail-key {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}
.detail-val {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
}
.detail-meta {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.38);
}
</style>
