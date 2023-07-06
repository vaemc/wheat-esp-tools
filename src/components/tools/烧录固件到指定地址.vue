<template>
  <div style="height: 100%">
    <a-input addon-before="烧录地址" placeholder="" style="margin-bottom: 5px" />

    <div :class="dropBoxClass" @click="openFileDialog">
      <span style="display: block; font-size: 16px; align-self: center">11111</span>
      <span
        style="display: block; font-size: 14px; color: gray; align-self: center">vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
      </span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
const dropBoxClass = ref("dropBox");

const openFileDialog = async () => { };
</script>
