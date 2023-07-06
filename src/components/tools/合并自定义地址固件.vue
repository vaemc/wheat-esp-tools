<template>
  <div style="height: 100%">
    <a-select style="width: 100%" placeholder="选择芯片" :options="chipTypeList"></a-select>



    <div style="margin-top: 5px;" :class="dropBoxClass" @click="openFileDialog">
      <span style="display: block; font-size: 16px; align-self: center">选择或者拖拽多个bin文件到此</span>
      <span style="display: block; font-size: 14px; color: gray; align-self: center">固件名称需要以下划线加烧录地址结尾如
        "ESP32_AT_0x222.bin"
      </span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
const dropBoxClass = ref("dropBox");
const chipTypeList = ref([
  "ESP32",
  "ESP32C2",
  "ESP32C3",
  "ESP32C6",
  "ESP32S2",
  "ESP32S3",
  "ESP32H2",
  "ESP8266",
].map(item => {
  return {
    value: item,
    label: item,
  }
}));
const openFileDialog = async () => { };
</script>
