<template>
  <div class="device-list">
    <PlaceholderHint v-if="!devices.length" :text="emptyText" class="empty" />
    <TransitionGroup v-else name="device-fade" tag="div" class="device-stack">
      <article
        v-for="record in devices"
        :key="record.address"
        class="device-card"
        :class="{
          expanded: expandedKey === record.address,
          connecting: connectingAddress === record.address,
          active: connectedAddress === record.address,
        }"
        @click="toggleExpand(record.address)"
      >
        <div class="card-main">
          <div class="avatar" :style="{ '--sig': rssiColor(record.rssi) }">
            <SignalBars :bars="rssiBars(record.rssi)" />
          </div>

          <div class="info">
            <div class="title-row">
              <h3
                class="name"
                :title="displayName(record.local_name, $t('ble.unknownName'))"
              >
                {{ displayName(record.local_name, $t("ble.unknownName")) }}
              </h3>
              <span
                class="rssi-pill"
                :style="{ color: rssiColor(record.rssi) }"
              >
                {{ record.rssi }} dBm
              </span>
            </div>
            <p v-copy class="mac" @click.stop>{{ record.address }}</p>
            <div class="meta-row">
              <span class="seen">{{ formatAgoShort(record.lastSeen, tick) }}</span>
              <span v-if="record.services.length" class="chips">
                <span
                  v-for="svc in record.services.slice(0, 3)"
                  :key="svc"
                  class="chip"
                >
                  {{ shortUuid(svc) }}
                </span>
                <span v-if="record.services.length > 3" class="chip more">
                  +{{ record.services.length - 3 }}
                </span>
              </span>
              <span v-else class="chips muted">{{ $t("ble.noServices") }}</span>
            </div>
          </div>

          <div class="actions" @click.stop>
            <a-button
              type="primary"
              size="small"
              class="connect-btn"
              :loading="connectingAddress === record.address"
              :disabled="
                (!!connectingAddress &&
                  connectingAddress !== record.address) ||
                connectedAddress === record.address
              "
              @click="$emit('connect', record)"
            >
              {{
                connectedAddress === record.address
                  ? $t("ble.connected")
                  : $t("ble.connect")
              }}
            </a-button>
          </div>
        </div>

        <div v-if="expandedKey === record.address" class="card-detail" @click.stop>
          <div v-if="mfgRows(record).length" class="detail-block">
            <div class="detail-label">{{ $t("ble.manufacturer") }}</div>
            <div v-for="row in mfgRows(record)" :key="row.id" class="detail-row">
              <span class="detail-key">{{ row.label }}</span>
              <code class="detail-val">{{ row.hex }}</code>
            </div>
          </div>

          <div v-if="record.services.length" class="detail-block">
            <div class="detail-label">{{ $t("ble.services") }}</div>
            <div class="tag-wrap">
              <span v-for="svc in record.services" :key="svc" class="svc-tag">
                {{ svc }}
              </span>
            </div>
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
      </article>
    </TransitionGroup>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import type { BleDeviceRecord } from "../types";
import PlaceholderHint from "@/components/PlaceholderHint.vue";
import SignalBars from "./SignalBars.vue";
import { useRelativeTimeTick } from "../composables/useRelativeTimeTick";
import {
  bytesToHex,
  displayName,
  formatAgoShort,
  formatManufacturerId,
  rssiBars,
  rssiColor,
} from "../utils/bleFormat";

defineProps<{
  devices: BleDeviceRecord[];
  emptyText: string;
  connectingAddress?: string | null;
  connectedAddress?: string | null;
}>();

defineEmits<{
  connect: [record: BleDeviceRecord];
}>();

const expandedKey = ref<string | null>(null);
const tick = useRelativeTimeTick();

function shortUuid(uuid: string): string {
  const u = uuid.replace(/^0x/i, "").replace(/-/g, "").toUpperCase();
  if (u.length === 32 && u.startsWith("0000") && u.endsWith("00001000800000805F9B34FB")) {
    return `0x${u.slice(4, 8)}`;
  }
  if (u.length <= 8) {
    return `0x${u}`;
  }
  return `${u.slice(0, 4)}…${u.slice(-4)}`;
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

function toggleExpand(address: string) {
  expandedKey.value = expandedKey.value === address ? null : address;
}
</script>
<style scoped>
.device-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 8px 8px;
}
.empty {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  text-align: center;
  box-sizing: border-box;
}
.device-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.device-card {
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;
}
.device-card:hover {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
}
.device-card.active {
  border-color: rgba(62, 207, 142, 0.45);
  background: rgba(62, 207, 142, 0.06);
}
.device-card.connecting {
  border-color: rgba(105, 177, 255, 0.4);
}
.card-main {
  display: grid;
  grid-template-columns: 44px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
}
.avatar {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--sig) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--sig) 28%, transparent);
}
.info {
  min-width: 0;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}
.name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: rgba(255, 255, 255, 0.92);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rssi-pill {
  flex-shrink: 0;
  font-family: Consolas, "Courier New", monospace;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.28);
}
.mac {
  margin: 0 0 6px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  cursor: copy;
  width: fit-content;
}
.mac:hover {
  color: rgba(255, 255, 255, 0.75);
}
.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.seen {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.38);
  font-variant-numeric: tabular-nums;
}
.chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  min-width: 0;
}
.chip {
  font-family: Consolas, "Courier New", monospace;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  color: rgba(145, 202, 255, 0.95);
  background: rgba(105, 177, 255, 0.12);
  border: 1px solid rgba(105, 177, 255, 0.18);
}
.chip.more {
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}
.muted {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
}
.actions {
  flex-shrink: 0;
}
.connect-btn {
  border-radius: 8px;
  font-weight: 500;
  min-width: 72px;
}
.card-detail {
  padding: 0 14px 12px 70px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin-top: -2px;
  animation: detail-in 0.18s ease;
}
@keyframes detail-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.detail-block {
  margin-top: 10px;
}
.detail-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 4px;
}
.detail-row {
  display: grid;
  grid-template-columns: minmax(100px, 160px) 1fr;
  gap: 8px;
  margin-bottom: 4px;
}
.detail-key {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
}
.detail-val {
  font-family: Consolas, "Courier New", monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.88);
  word-break: break-all;
}
.detail-val.block {
  display: block;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.28);
  border-radius: 6px;
}
.tag-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.svc-tag {
  font-family: Consolas, "Courier New", monospace;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.75);
  background: rgba(255, 255, 255, 0.06);
}
.detail-meta {
  margin-top: 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.32);
}
.device-fade-enter-active,
.device-fade-leave-active {
  transition: all 0.2s ease;
}
.device-fade-enter-from,
.device-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
@media (max-width: 640px) {
  .card-main {
    grid-template-columns: 40px 1fr;
  }
  .actions {
    grid-column: 2;
    justify-self: start;
  }
  .card-detail {
    padding-left: 14px;
  }
}
</style>
