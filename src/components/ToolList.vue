<template>
  <a-card size="small">
    <a-tabs @change="activeKey">
      <a-tab-pane tab="基本功能" key="1">
        <Basic />
      </a-tab-pane>
      <a-tab-pane tab="烧录或合并固件" key="2">
        <FlasFirmwareTool />
      </a-tab-pane>
      <a-tab-pane tab="分区表" key="3">
        <PartitionTableTool />
      </a-tab-pane>
      <a-tab-pane tab="历史操作" key="4">
        <HistoryPath />
      </a-tab-pane>
      <a-tab-pane tab="快捷烧录" key="5">
        <FirmwareList />
      </a-tab-pane>
    </a-tabs>
  </a-card>
</template>
<script setup lang="ts">
import { ref } from "vue"
import FirmwareList from "./tools/firmware-list/FirmwareList.vue";
import HistoryPath from "./tools/history-path/HistoryPath.vue";
import Basic from "./tools/basic/Index.vue";
import PartitionTableTool from "./tools/partition-table/Index.vue";
import FlasFirmwareTool from "./tools/flash-merge/Index.vue";

const activeKey = ref("1");
</script>
