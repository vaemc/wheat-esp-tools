<template>
  <div style="height: 100%">
    <Upload
      title="选择或者拖拽文件到此"
      subtitle="烧录build目录的固件"
      :isDirectory="true"
      :isMultiple="false"
      @openFileDialog="openFileDialog"
      @drop="drop"
      @dropHover="dropHover"
      @dropCancelled="dropCancelled"
    />
  </div>
</template>
<script setup lang="ts">
const drop = (path: String | String[]) => {
  console.log(path);
};
const dropHover = () => {};
const dropCancelled = () => {};

const openFileDialog = (path: String | String[]) => {
  console.log(path);
};
</script>
