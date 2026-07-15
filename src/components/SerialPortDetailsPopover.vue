<template>
  <a-popover
    v-model:open="open"
    placement="bottomLeft"
    trigger="click"
    overlay-class-name="serial-port-details-popover"
    @open-change="onOpenChange"
  >
    <template #content>
      <div class="popover-head">{{ $t("device.portListTitle") }}</div>
      <a-spin :spinning="loading && ports.length === 0">
        <div class="port-list">
          <div v-if="ports.length === 0 && !loading" class="empty">
            {{ $t("device.portNotFound") }}
          </div>
          <div v-for="item in ports" :key="item.portName" class="port-item">
            <div class="port-name">{{ item.portName }}</div>
            <div class="port-line">
              {{ $t("device.portFriendlyName") }}:
              {{ item.friendlyName || "—" }}
            </div>
            <div class="port-line">
              {{ $t("device.portDescription") }}:
              {{ item.description || "—" }}
            </div>
            <div class="port-line">
              {{ $t("device.portSerialNumber") }}:
              {{ item.serialNumber || "—" }}
            </div>
          </div>
        </div>
      </a-spin>
    </template>
    <a-button size="small" class="port-details-btn">
      {{ $t("device.portDetails") }}
    </a-button>
  </a-popover>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { getSerialPortDetails } from "@/utils/common";
import type { SerialPortDetail } from "@/types/serial";

const REFRESH_MS = 2000;

const open = ref(false);
const loading = ref(false);
const ports = ref<SerialPortDetail[]>([]);
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let refreshing = false;
let refreshSeq = 0;

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
};

const refresh = async () => {
  if (refreshing) {
    return;
  }
  const seq = ++refreshSeq;
  refreshing = true;
  loading.value = true;
  try {
    const list = await getSerialPortDetails();
    if (seq === refreshSeq) {
      ports.value = list;
    }
  } finally {
    if (seq === refreshSeq) {
      loading.value = false;
    }
    refreshing = false;
  }
};

const startAutoRefresh = () => {
  stopAutoRefresh();
  void refresh();
  refreshTimer = setInterval(() => {
    void refresh();
  }, REFRESH_MS);
};

const onOpenChange = (visible: boolean) => {
  if (visible) {
    startAutoRefresh();
    return;
  }
  stopAutoRefresh();
};

onUnmounted(() => {
  stopAutoRefresh();
});
</script>

<style scoped>
.port-details-btn {
  flex-shrink: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.04);
}
.port-details-btn:hover {
  color: rgba(255, 255, 255, 0.92);
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.08);
}

.popover-head {
  margin-bottom: 8px;
  font-weight: 500;
}

.port-list {
  max-height: min(60vh, 480px);
  overflow-y: auto;
}

.port-item + .port-item {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.port-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.port-line {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.5;
  word-break: break-all;
}

.empty {
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
}
</style>

<style>
.serial-port-details-popover {
  max-width: 360px;
}
.serial-port-details-popover .ant-popover-inner {
  background: #1f1f1f;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
