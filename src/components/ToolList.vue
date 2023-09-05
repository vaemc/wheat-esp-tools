<template>
  <a-card size="small">
    <a-tabs v-model:activeKey="activeKey">
      <a-tab-pane tab="基本功能" key="1">
        <BasicTool />
      </a-tab-pane>
      <a-tab-pane tab="烧录或合并固件" key="2">
        <FlasFirmwareTool />
      </a-tab-pane>
      <a-tab-pane tab="分区表" key="3">
        <PartitionTableTool />
      </a-tab-pane>
      <a-tab-pane tab="文件系统" key="4">
        <FileSystemTool />
      </a-tab-pane>
      <a-tab-pane tab="快捷烧录" key="5">
        <QuickFlashTool />
      </a-tab-pane>
    </a-tabs>
  </a-card>
</template>
<script setup lang="ts">
import { ref } from "vue";
import QuickFlashTool from "./tools/quick-flash/Index.vue";
import BasicTool from "./tools/basic/Index.vue";
import FileSystemTool from "./tools/file-system/Index.vue";
import PartitionTableTool from "./tools/partition-table/Index.vue";
import FlasFirmwareTool from "./tools/flash-merge/Index.vue";

const activeKey = ref("1");
</script>
