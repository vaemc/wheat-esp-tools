<template>
  <SPIMode v-model="selectedMode" />
  <Upload
    v-if="drop"
    title="选择或者拖拽文件到此"
    subtitle="烧录地址为0x0的固件"
    :isDirectory="false"
    :isMultiple="false"
    @open="uploadHandle"
    @drop="uploadHandle"
  />
</template>
<script setup lang="ts">
import {
  selectedPort,
  executedCommand,
  addHistoryPath,
} from "../../utils/common";
import { ref } from "vue";
import SPIMode from "../SPIMode.vue";
defineProps(["drop"]);
const selectedMode = ref("keep");
function generatedCommand(data: any) {
  const { path } = data;
  let cmd = [
    "-p",
    selectedPort(),
    "-b",
    "1152000",
    "write_flash",
    "--flash_mode",
    selectedMode.value,
    "0x0",
    path,
  ];
  executedCommand(cmd);
  addHistoryPath(path);
}

const uploadHandle = (path: string | string[]) => {
  generatedCommand({ path: path });
};
</script>
