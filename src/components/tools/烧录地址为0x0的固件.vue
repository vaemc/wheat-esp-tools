<template>
  <a-radio-group v-model:value="spiMode" button-style="solid" style="margin-bottom: 5px;">
    <a-radio-button value="keep">keep</a-radio-button>
    <a-radio-button value="qio">qio</a-radio-button>
    <a-radio-button value="qout">qout</a-radio-button>
    <a-radio-button value="dio">dio</a-radio-button>
    <a-radio-button value="dout">dout</a-radio-button>
  </a-radio-group>
  <Upload
    title="选择或者拖拽文件到此"
    subtitle="烧录地址为0x0的固件"
    :isDirectory="false"
    :isMultiple="false"
    @openFileDialog="openFileDialog"
    @drop="drop"
  />
</template>
<script setup lang="ts">
import {
  selectedPort,
  executedCommand,
  addHistoryPath,
} from "../../utils/common";
import { ref } from "vue";

const spiMode = ref("keep");

function generatedCommand(data: any) {
  const { path } = data;
  let cmd = [
    "-p",
    selectedPort(),
    "-b",
    "1152000",
    "write_flash",
    "--flash_mode",
    spiMode.value,
    "0x0",
    path,
  ];
  executedCommand(cmd);
  addHistoryPath(path);
}

const drop = (path: String | String[]) => {
  generatedCommand({ path: path });
};

const openFileDialog = (path: String | String[]) => {
  generatedCommand({ path: path });
};
</script>
