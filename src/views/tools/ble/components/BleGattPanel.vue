<template>
  <section class="gatt-panel">
    <header class="gatt-head">
      <div class="gatt-title">
        <span class="dot" :class="{ on: connected }" />
        <div class="title-text">
          <template v-if="connected && info">
            <strong>{{ info.name || $t("ble.unknownName") }}</strong>
            <span class="mono muted">{{ info.address }}</span>
          </template>
          <template v-else>
            <strong>{{ $t("ble.gattTitle") }}</strong>
            <span class="muted">{{ $t("ble.gattIdle") }}</span>
          </template>
        </div>
      </div>
      <a-button
        v-if="connected"
        size="small"
        danger
        ghost
        :disabled="busy"
        @click="emit('disconnect')"
      >
        {{ $t("ble.disconnect") }}
      </a-button>
    </header>

    <div v-if="!connected" class="idle-card">
      <div class="idle-icon">BLE</div>
      <p>{{ $t("ble.gattIdleHint") }}</p>
    </div>

    <template v-else-if="info">
      <div class="quick-card">
        <div class="quick-bar">
          <a-input
            v-model:value="txText"
            size="middle"
            :placeholder="$t('ble.msgPlaceholder')"
            :disabled="busy"
            @pressEnter="onSendEcho"
          />
          <a-button type="primary" :loading="busy" @click="onSendEcho">
            {{ $t("ble.sendEcho") }}
          </a-button>
        </div>
        <div class="quick-meta">
          <a-tag v-if="lastCounter != null" color="cyan">
            {{ $t("ble.counter") }}: {{ lastCounter }}
          </a-tag>
          <span class="hint">{{ $t("ble.espTestHintShort") }}</span>
        </div>
      </div>

      <div class="svc-list">
        <div v-for="svc in info.services" :key="svc.uuid" class="svc-block">
          <div class="svc-uuid mono">{{ shortUuid(svc.uuid) }}</div>
          <div
            v-for="ch in svc.characteristics"
            :key="ch.uuid"
            class="char-row"
          >
            <div class="char-meta">
              <span class="mono">{{ shortUuid(ch.uuid) }}</span>
              <span class="props">{{ ch.properties.join(" · ") }}</span>
            </div>
            <div class="char-actions">
              <button
                v-if="ch.properties.includes('read')"
                type="button"
                class="pill-btn"
                :disabled="busy"
                @click="emit('read', svc.uuid, ch.uuid)"
              >
                {{ $t("ble.read") }}
              </button>
              <button
                v-if="
                  ch.properties.includes('write') ||
                  ch.properties.includes('write_without_response')
                "
                type="button"
                class="pill-btn"
                :disabled="busy"
                @click="emit('write', svc.uuid, ch.uuid, txText)"
              >
                {{ $t("ble.write") }}
              </button>
              <button
                v-if="
                  ch.properties.includes('notify') ||
                  ch.properties.includes('indicate')
                "
                type="button"
                class="pill-btn"
                :class="{ active: isSubscribed(ch.uuid) }"
                :disabled="busy"
                @click="
                  isSubscribed(ch.uuid)
                    ? emit('unsubscribe', svc.uuid, ch.uuid)
                    : emit('subscribe', svc.uuid, ch.uuid)
                "
              >
                {{
                  isSubscribed(ch.uuid)
                    ? $t("ble.unsubscribe")
                    : $t("ble.subscribe")
                }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div class="log-head">
      <span>{{ $t("ble.logTitle") }}</span>
      <a-button type="link" size="small" @click="emit('clear-logs')">
        {{ $t("ble.clearLog") }}
      </a-button>
    </div>
    <div ref="logEl" class="log-box">
      <div
        v-for="line in logs"
        :key="line.id"
        class="log-line"
        :class="line.kind"
      >
        <span class="log-time">{{ formatTime(line.at) }}</span>
        {{ line.text }}
      </div>
      <div v-if="!logs.length" class="log-empty">{{ $t("ble.logEmpty") }}</div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import type { BleConnectInfo, BleLogLine } from "../composables/useBleConnection";
import { shortUuid } from "../composables/useBleConnection";

const props = defineProps<{
  connected: boolean;
  busy: boolean;
  info: BleConnectInfo | null;
  logs: BleLogLine[];
  lastCounter: number | null;
  isSubscribed: (uuid: string) => boolean;
}>();

const emit = defineEmits<{
  disconnect: [];
  read: [serviceUuid: string, charUuid: string];
  write: [serviceUuid: string, charUuid: string, text: string];
  subscribe: [serviceUuid: string, charUuid: string];
  unsubscribe: [serviceUuid: string, charUuid: string];
  "clear-logs": [];
  "send-echo": [text: string];
}>();

const txText = ref("hello");
const logEl = ref<HTMLElement | null>(null);

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour12: false });
}

function onSendEcho() {
  emit("send-echo", txText.value.trim() || "hello");
}

watch(
  () => props.logs.length,
  async () => {
    await nextTick();
    if (logEl.value) {
      logEl.value.scrollTop = logEl.value.scrollHeight;
    }
  }
);
</script>
<style scoped>
.gatt-panel {
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
}
.gatt-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.gatt-title {
  display: flex;
  gap: 10px;
  min-width: 0;
}
.title-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.title-text strong {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
}
.dot {
  width: 9px;
  height: 9px;
  margin-top: 4px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
  flex-shrink: 0;
}
.dot.on {
  background: #3ecf8e;
  box-shadow: 0 0 0 3px rgba(62, 207, 142, 0.18);
}
.idle-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 12px;
  margin-bottom: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  text-align: center;
}
.idle-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: rgba(145, 202, 255, 0.9);
  background: rgba(105, 177, 255, 0.1);
  border: 1px solid rgba(105, 177, 255, 0.18);
}
.idle-card p {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.45;
  max-width: 260px;
}
.quick-card {
  margin-bottom: 10px;
  padding: 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.quick-bar {
  display: flex;
  gap: 8px;
}
.quick-bar :deep(.ant-input) {
  flex: 1;
  border-radius: 8px;
}
.quick-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.38);
}
.svc-list {
  max-height: 200px;
  overflow: auto;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.svc-block {
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}
.svc-uuid {
  font-size: 11px;
  color: #91caff;
  margin-bottom: 6px;
}
.char-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}
.char-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.props {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.38);
}
.char-actions {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.pill-btn {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.78);
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}
.pill-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.22);
}
.pill-btn.active {
  color: #3ecf8e;
  border-color: rgba(62, 207, 142, 0.4);
  background: rgba(62, 207, 142, 0.12);
}
.pill-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.mono {
  font-family: Consolas, "Courier New", monospace;
  font-size: 11px;
}
.muted {
  color: rgba(255, 255, 255, 0.42);
  font-weight: 400;
  font-size: 11px;
}
.log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}
.log-box {
  height: 132px;
  overflow: auto;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 8px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 11px;
}
.log-line {
  margin-bottom: 3px;
  word-break: break-all;
  color: rgba(255, 255, 255, 0.75);
}
.log-line.tx {
  color: #91caff;
}
.log-line.rx {
  color: #b7eb8f;
}
.log-line.error {
  color: #ff7875;
}
.log-line.info {
  color: rgba(255, 255, 255, 0.48);
}
.log-time {
  color: rgba(255, 255, 255, 0.28);
  margin-right: 6px;
}
.log-empty {
  color: rgba(255, 255, 255, 0.28);
}
</style>
