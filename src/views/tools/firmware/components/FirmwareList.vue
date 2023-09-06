<template>
  <div style="margin: 5px">
    <a href="#" @click="openFileInExplorer(currentDir + ' \\firmware')">打开文件夹</a>
    <a-input-search style="margin: 5px 0" placeholder="" enter-button @search="onSearch" />
    <List :pathList="pathList" @remove="remove" />
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import List from "./List.vue";
import { getFirmwareList, getCurrentDir, openFileInExplorer, removeFile } from "@/utils/common";
import emitter from "@/utils/bus";
const pathList = ref([] as any);
const currentDir = await getCurrentDir();


const remove = (path: string) => {
  removeFile(path);

};

const onSearch = async (text: string) => {
  if (text == "") {

  } else {
    // pathList.value = pathList.value.filter((x) =>
    //   x.toLowerCase().includes(text.toLowerCase())
    // );
  }
};

</script>
