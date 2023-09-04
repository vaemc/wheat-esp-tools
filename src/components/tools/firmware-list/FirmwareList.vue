<template>
  <div style="margin: 5px">
    <a href="#" @click="openFileInExplorer(currentDir + ' \\firmware')">打开文件夹</a>
    <a-input-search style="margin: 5px 0" placeholder="" enter-button @search="onSearch" />
    <List :pathList="pathList" @remove="remove" />
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import List from "../List.vue";
import { getFirmwareList, getCurrentDir, openFileInExplorer, removeFile } from "../../common";

import { Path } from "../model";
import emitter from "../bus";
const pathList = ref([] as Path[]);
const currentDir = await getCurrentDir();
async function refresh() {
  const firmwareList = await getFirmwareList();
  pathList.value = firmwareList.map((item) => {
    return {
      full: `${currentDir}\\firmware\\${item}`,
      name: item,
    } as Path;
  });
}
refresh();
const remove = (path: string) => {
  removeFile(path);
  refresh();
};

const onSearch = async (text: string) => {
  if (text == "") {
    refresh();
  } else {
    pathList.value = pathList.value.filter((x) =>
      x.full.toLowerCase().includes(text.toLowerCase())
    );
  }
};
emitter.on("refreshFirmwareList", async (data) => {
  refresh();
});
</script>
