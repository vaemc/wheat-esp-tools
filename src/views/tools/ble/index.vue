<template>
  <a-float-button
    @click="aaa"
    type="primary"
    :style="{
      right: '24px',
    }"
  >
    <template #icon>
      <ReloadOutlined />
    </template>
    <template #tooltip>
      <div>刷新</div>
    </template>
  </a-float-button>
</template>
<script setup lang="ts">
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import { ReloadOutlined } from "@ant-design/icons-vue";
await listen("ble_device_scan_event", (event: any) => {
  console.log(event.payload);
});
const aaa =async () => {
  await invoke("ble_device_scan", {});
};
</script>
