<template>
  <div>
    <Popup :pathList="pathList" @remove="remove" />
 
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import Popup from "./Popup.vue";
import {
  getFirmwareList,
  getCurrentDir,
  removeFile,
  openFileInExplorer,
} from "../utils/common";
import { Path } from "../utils/model";
import emitter from "../utils/bus";

const pathList = ref([] as Path[]);
const currentDir = await getCurrentDir();

const emit = defineEmits<{
  (e: "flash", path: string): void;
}>();

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

function flash(path: string) {
  emit("flash", path);
}
</script>
