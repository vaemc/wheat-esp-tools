<template>
  <div>
    <List :pathList="pathList" @remove="remove" />
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import List from "./List.vue";
import {
  getFirmwareList,
  getCurrentDir,
  removeFile,
} from "../utils/common";
import { Path } from "../utils/model";
import emitter from "../utils/bus";
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

emitter.on("refreshFirmwareList", async (data) => {
  refresh();
});

</script>
