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
          linked: record.connected,
        }"
        @click="toggleExpand(record.address)"
      >
        <div class="card-main">
          <div
            class="avatar"
            :style="{
              '--sig':
                record.rssi != null ? rssiColor(record.rssi) : 'rgba(255,255,255,0.35)',
            }"
          >
            <SignalBars
              v-if="record.rssi != null"
              :bars="rssiBars(record.rssi)"
            />
            <span v-else class="avatar-fallback">BT</span>
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
                v-if="record.rssi != null"
                class="rssi-pill"
                :style="{ color: rssiColor(record.rssi) }"
              >
                {{ record.rssi }} dBm
              </span>
            </div>
            <p v-copy class="mac" @click.stop>{{ record.address }}</p>
            <div class="meta-row">
              <span class="seen">{{ formatAgoShort(record.lastSeen, tick) }}</span>
              <span class="chip">{{ record.class_category || record.class_of_device }}</span>
              <span v-if="record.connected" class="status on">
                {{ $t("ble.classicConnected") }}
              </span>
              <span v-if="record.paired" class="status">
                {{ $t("ble.classicPaired") }}
              </span>
              <span v-if="record.authenticated" class="status">
                {{ $t("ble.classicAuthenticated") }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="expandedKey === record.address" class="card-detail" @click.stop>
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
      </article>
    </TransitionGroup>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import type { ClassicBtDeviceRecord } from "../types";
import PlaceholderHint from "@/components/PlaceholderHint.vue";
import SignalBars from "./SignalBars.vue";
import { useRelativeTimeTick } from "../composables/useRelativeTimeTick";
import {
  displayName,
  formatAgoShort,
  rssiBars,
  rssiColor,
} from "../utils/bleFormat";

defineProps<{
  devices: ClassicBtDeviceRecord[];
  emptyText: string;
}>();

const { t } = useI18n();
const expandedKey = ref<string | null>(null);
const tick = useRelativeTimeTick();

function yesNo(v: boolean): string {
  return v ? t("ble.classicYes") : t("ble.classicNo");
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
    background 0.18s ease;
}
.device-card:hover {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
}
.device-card.linked {
  border-color: rgba(62, 207, 142, 0.4);
  background: rgba(62, 207, 142, 0.05);
}
.card-main {
  display: grid;
  grid-template-columns: 44px 1fr;
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
.avatar-fallback {
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.55);
  letter-spacing: 0.04em;
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
.meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.seen {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.38);
}
.chip {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.65);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.status {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  color: rgba(145, 202, 255, 0.95);
  background: rgba(105, 177, 255, 0.12);
  border: 1px solid rgba(105, 177, 255, 0.18);
}
.status.on {
  color: rgba(62, 207, 142, 0.95);
  background: rgba(62, 207, 142, 0.12);
  border-color: rgba(62, 207, 142, 0.22);
}
.card-detail {
  padding: 0 14px 12px 70px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
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
  grid-template-columns: 120px 1fr;
  gap: 8px;
  margin-bottom: 4px;
}
.detail-key {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
}
.detail-val {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.88);
}
.mono {
  font-family: Consolas, "Courier New", monospace;
  font-size: 11px;
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
</style>
