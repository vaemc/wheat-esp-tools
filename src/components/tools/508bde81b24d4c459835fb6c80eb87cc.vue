<template>
  <div style="height: 100%">
    <div :class="dropBoxClass" @click="openFileDialog">
      <span style="display: block; font-size: 16px; align-self: center">bbbbbb</span>
      <span style="display: block; font-size: 14px; color: gray; align-self: center">bdsfsdf
      </span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onBeforeUnmount } from "vue";
import { listen } from "@tauri-apps/api/event";

/**
 * 每一个插件都必须带有pluginName
 */
const pluginName = "合并build目录的固件"

const drop = await listen("tauri://file-drop", (event: any) => {

});

const dropHover = await listen("tauri://file-drop-hover", (event: any) => {

});

const dropCancelled = await listen("tauri://file-drop-cancelled", () => {

});



onBeforeUnmount(() => {
  drop();
  dropHover();
  dropCancelled();
});


const dropBoxClass = ref("dropBox");

const openFileDialog = async () => {

};
</script>
