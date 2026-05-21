<template>
  <div class="partition-page">
    <SerialPortSelect />

    <a-tabs v-model:activeKey="activeTab" class="partition-tabs">
      <a-tab-pane key="align" :tab="$t('partition.tabAlign')">
        <PartitionAlignPanel />
      </a-tab-pane>
      <a-tab-pane key="device" :tab="$t('partition.tabDevice')">
        <PartitionDevicePanel />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import SerialPortSelect from "@/components/SerialPortSelect.vue";
import PartitionAlignPanel from "./components/PartitionAlignPanel.vue";
import PartitionDevicePanel from "./components/PartitionDevicePanel.vue";

const activeTab = ref("align");
</script>
<style scoped>
.partition-page {
  padding: 12px 16px;
}
.partition-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 12px;
}
</style>
