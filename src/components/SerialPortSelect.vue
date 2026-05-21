<template>
  <a-select
    v-model:value="port"
    style="width: 100%; margin: 0 0 10px"
    :placeholder="$t('device.selectPort')"
    :loading="store.loadingPorts"
    :options="store.portOptions"
    @dropdown-visible-change="onDropdownOpen"
    @change="onPortChange"
  />
</template>
<script setup lang="ts">
import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useDeviceStore } from "@/stores/device";

/** 页面内嵌串口选择（与侧栏共用 device store） */
const store = useDeviceStore();
const { port } = storeToRefs(store);

function onDropdownOpen(open: boolean) {
  if (open) {
    store.refreshPortList();
  }
}

function onPortChange(value: string) {
  if (value) {
    store.setPort(value);
  }
}

onMounted(() => {
  if (!store.portOptions.length) {
    store.refreshPortList();
  }
});
</script>
