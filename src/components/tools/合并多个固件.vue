<template>
  <div style="height: 100%">
    <a-select
      style="width: 100%; margin-bottom: 5px"
      placeholder="选择芯片"
      :options="chipTypeList"
    ></a-select>

    <a-input-group compact style="margin-bottom: 5px">
      <a-input
        style="width: 15%; border-left: 0; pointer-events: none"
        placeholder="固件路径"
        disabled
      />
      <a-input style="width: 35%; border-left: 0" placeholder="" />
      <a-input
        style="width: 15%; border-left: 0; pointer-events: none"
        placeholder="烧录地址"
        disabled
      />
      <a-input style="width:35%; border-left: 0" placeholder="" />
    </a-input-group>

    <Upload
      title="选择或者拖拽多个bin文件到此"
      subtitle="固件名称需要以下划线加烧录地址结尾如 'ESP32_0x222.bin'"
      @openFileDialog="openFileDialog"
    />
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
const dropBoxClass = ref("dropBox");
const chipTypeList = ref(
  [
    "ESP32",
    "ESP32C2",
    "ESP32C3",
    "ESP32C6",
    "ESP32S2",
    "ESP32S3",
    "ESP32H2",
    "ESP8266",
  ].map((item) => {
    return {
      value: item,
      label: item,
    };
  })
);
const openFileDialog = async () => {};
</script>
