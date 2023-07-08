<template>
  <div style="overflow: auto">
    <a-popover v-for="item in firmwareList" :title="item" trigger="click">
      <template #content>
        <a-button style="margin: 3px" @click="flash(item as string)"
          >烧录</a-button
        >
        <a-button style="margin: 3px" @click="open()" primary>打开</a-button>
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
import { runCmd, generateCmd } from "../utils/esptool";
import { toolListConfig } from "../utils/tools-config";
import {
  getFirmwareList,
  openFileInExplorer,
  getCurrentDir,
  removeFile,
} from "../utils/common";
import emitter from "../utils/bus";
console.info(toolListConfig);
// openFileInExplorer(currentDir + "\\firmware");
const firmwareList = ref(await getFirmwareList());
const currentDir = await getCurrentDir();

emitter.on("refreshFirmwareList", async (data) => {
  firmwareList.value = await getFirmwareList();
});

async function flash(item: string) {
  // let path = currentDir + "\\firmware\\" + item;
  // let cmd = (await generateCmd(toolListConfig[2].cmd, path)) as string[];
  // runCmd(cmd);
}

function open() {
  openFileInExplorer(currentDir + "\\firmware");
}

async function remove(item: string) {
  removeFile(currentDir + "\\firmware\\" + item);
  firmwareList.value = await getFirmwareList();
}
</script>
