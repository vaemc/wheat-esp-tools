<template>
  <div style="overflow: auto">
    <a-popover v-for="item in firmwareList" :title="item" trigger="click">
      <template #content>
        <a-button style="margin: 3px" @click="flash(item as string)"
          >烧录</a-button
        >
        <a-button style="margin: 3px" @click="open(item as string)" primary
          >打开</a-button
        >
        <a-button style="margin: 3px" @click="remove(item as string)" danger
          >删除</a-button
        >
      </template>
      <a-button type="dashed" size="small" style="margin: 3px">{{
        item
      }}</a-button>
    </a-popover>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import {
  executedCommand,
  getFirmwareList,
  openFileInExplorer,
  getCurrentDir,
  removeFile,
  selectedPort,
} from "../utils/common";
import emitter from "../utils/bus";
const firmwareList = ref(await getFirmwareList());
const currentDir = await getCurrentDir();

emitter.on("refreshFirmwareList", async (data) => {
  firmwareList.value = await getFirmwareList();
});

async function flash(item: String) {
  let cmd = [
    "-p",
    selectedPort(),
    "-b",
    "1152000",
    "write_flash",
    "0x0",
    `${currentDir}\\firmware\\${item}`,
  ];
  executedCommand(cmd);
}

function open(item: String) {
  openFileInExplorer(`${currentDir}\\firmware\\${item}`);
}

async function remove(item: string) {
  removeFile(`${currentDir}\\firmware\\${item}`);
  firmwareList.value = await getFirmwareList();
}
</script>
