<template>
  <div class="box">
    <div class="row header">
      <SerialPortSelect />
    </div>
    <div class="row content">
      <div style="display: flex; flex-direction: column; height: 100%">
        <ToolList style="margin-top: 5px; flex: 1" />
        <a-card size="small" style="margin-top: 5px; flex: 1" >
          <a-tabs v-model:activeKey="activeKey">
            <a-tab-pane key="1" tab="历史操作"><HistoryPath /></a-tab-pane>
            <a-tab-pane key="2" tab="快捷烧录" force-render
              ><FirmwareList
            /></a-tab-pane>
          </a-tabs>
        </a-card>
      </div>
    </div>
    <div class="row footer" style="margin-top: 5px">
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
import WebSocket from "tauri-plugin-websocket-api";

const ws = await WebSocket.connect("ws://localhost:8686");

await ws.send("Hello World");

await ws.disconnect();
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
  padding: 10px 10px 0 10px;
}
.box .row.content {
  flex: 1 1 auto;
  padding: 0 10px 0 10px;
}
.box .row.footer {
  flex: 0 1 auto;
}
</style>
