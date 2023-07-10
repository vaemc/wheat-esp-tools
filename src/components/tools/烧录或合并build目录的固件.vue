<template>
  <div style="height: 100%">
    <a-radio-group value="a" style="margin-bottom: 5px;" button-style="solid">
      <a-radio-button value="a">烧录</a-radio-button>
      <a-radio-button value="b">合并</a-radio-button>
    </a-radio-group>

    <Upload
      title="选择或者拖拽文件到此"
      subtitle="合并build目录的固件"
      :isDirectory="true"
      :isMultiple="false"
      @openFileDialog="openFileDialog"
      @drop="drop"
    />
  </div>
</template>
<script setup lang="ts">
const drop = (path: String | String[]) => {
  console.log(path);
};

const openFileDialog = (path: String | String[]) => {
  console.log(path);
};
</script>
