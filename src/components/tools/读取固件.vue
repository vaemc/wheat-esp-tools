<template>
  <div style="display: flex;justify-content: center;">
    <a-button type="primary">开始读取</a-button>
  </div>
</template>
<script setup lang="ts">
const drop = (path: string | string[]) => {
  console.log(path);
};
const openFileDialog = (path: string | string[]) => {
  console.log(path);
};
</script>
