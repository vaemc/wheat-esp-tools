<template>
  <div style="padding: 10px">
    <SerialPortSelect />
    <a-tabs v-model:activeKey="activeKey">
      <a-tab-pane key="1" tab="路径"> <HistoryPathTool /></a-tab-pane>
      <a-tab-pane key="2" tab="固件"> <FirmwareListTool /></a-tab-pane>
    </a-tabs>
  </div>
</template>
<script setup lang="ts">
import SerialPortSelect from "@/components/SerialPortSelect.vue";
import { ref } from "vue";
import FirmwareListTool from "./components/FirmwareList.vue";
import HistoryPathTool from "./components/HistoryPath.vue";
const activeKey = ref("1");
</script>
