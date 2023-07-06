<template>
  <div class="box">
    <div class="row header">
      <SerialPortSelect />
    </div>
    <div class="row content">
      <div style="display: flex; flex-direction: column; height: 100%">
        <ToolList style="margin-top: 5px; flex: 1" />
        <HistoryPath style="margin-top: 5px; flex: 1" />
        <FirmwareList style="margin-top: 5px; flex: 1" />
      </div>
    </div>
    <div class="row footer" style="margin-top: 5px">
      <Terminal />
    </div>
  </div>
</template>
<script setup lang="ts">
import SerialPortSelect from "./SerialPortSelect.vue";
import ToolList from "./ToolList.vue";
import SimpleToolList from "./SimpleToolList.vue";
import Terminal from "./Terminal.vue";
import FirmwareList from "./FirmwareList.vue";
import HistoryPath from "./HistoryPath.vue";
</script>
<style>
.box {
  display: flex;
  flex-flow: column;
  height: 100%;
}

.box .row.header {
  flex: 0 1 auto;
  padding: 10px 10px 0 10px;
}
.box .row.content {
  flex: 1 1 auto;
  padding: 10px 10px 0 10px;
}
.box .row.footer {
  flex: 0 1 auto;
}
</style>
