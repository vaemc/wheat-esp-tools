<template>
  <div style="margin: 5px">
    <a-input-search
      style="margin: 5px 0"
      placeholder=""
      enter-button
      @search="onSearch"
    />
    <List :pathList="pathList" @remove="remove" />
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import List from "./List.vue";
import { getFirmwareList, getCurrentDir, removeFile } from "../utils/common";
import { Path } from "../utils/model";
import emitter from "../utils/bus";
const search = ref();
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
