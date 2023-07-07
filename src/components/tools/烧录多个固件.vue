<template>
  <div style="height: 100%">
    <a-input
      addon-before="烧录地址"
      placeholder=""
      style="margin-bottom: 5px"
    />

    <Upload
      title="选择或者拖拽文件到此"
      subtitle="烧录build目录的固件"
      @openFileDialog="openFileDialog"
    />
  </div>
</template>
<script setup lang="ts">
import { ref, onBeforeUnmount } from "vue";
import { listen } from "@tauri-apps/api/event";

import { open } from "@tauri-apps/api/dialog";

const openFileDialog = async () => {
  const selected = await open({
    directory: true,
    multiple: true,
  });

  if (selected !== null) {
    if (!Array.isArray(selected)) {
    }
  }
};

const drop = await listen("tauri://file-drop", (event: any) => {});

const dropHover = await listen("tauri://file-drop-hover", (event: any) => {});

const dropCancelled = await listen("tauri://file-drop-cancelled", () => {});

onBeforeUnmount(() => {
  drop();
  dropHover();
  dropCancelled();
});
</script>
