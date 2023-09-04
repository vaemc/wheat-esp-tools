<template>
  <div class="box">
    <div class="row header">
      <SerialPortSelect />
    </div>
    <div class="row content">
      <div style="display: flex; flex-direction: column; height: 100%">
        <ToolList style="margin-top: 5px; flex: 1" />
      </div>
    </div>
    <div class="row footer">
      <Terminal />
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import SerialPortSelect from "./SerialPortSelect.vue";
import ToolList from "./ToolList.vue";
import Terminal from "./Terminal.vue";
import FirmwareList from "./FirmwareList.vue";
import HistoryPath from "./HistoryPath.vue";
import { resourceDir } from "@tauri-apps/api/path";
const resourceDirPath = await resourceDir();
const activeKey = ref("1");
</script>
<style>
.box {
  display: flex;
  flex-flow: column;
  height: 100%;
}
.box .row.header {
  flex: 0 1 auto;
  padding: 5px 5px 0 5px;
}
.box .row.content {
  flex: 1 1 auto;
  padding: 0 5px 0 5px;
}
.box .row.footer {
  flex: 0 1 auto;
  margin-top: 5px;
}
</style>
