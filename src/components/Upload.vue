<template>
  <div style="height: 100%">
    <div :class="dropBoxClass" @click="openFileDialog">
      <inbox-outlined
        :style="{ fontSize: '40px', color: '#08c' }"
      ></inbox-outlined>
      <span style="display: block; font-size: 16px; align-self: center">{{
        props.title
      }}</span>
      <span
        style="display: block; font-size: 14px; color: gray; align-self: center"
        >{{ props.subtitle }}
      </span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onBeforeUnmount } from "vue";
import { InboxOutlined } from "@ant-design/icons-vue";
import { listen } from "@tauri-apps/api/event";

const dropBoxClass = ref("dropBox");

const emit = defineEmits<{
  (e: "openFileDialog", {}): void;
}>();

const props = defineProps(["title", "subtitle"]);

const openFileDialog = async () => {
  emit("openFileDialog", "ok");
};

const drop = await listen("tauri://file-drop", (event: any) => {
  dropBoxClass.value = "dropBox";
  console.log(235353);
  
});

const dropHover = await listen("tauri://file-drop-hover", (event: any) => {
  dropBoxClass.value = "dropBoxHover";
});

const dropCancelled = await listen("tauri://file-drop-cancelled", () => {
  dropBoxClass.value = "dropBox";
});

onBeforeUnmount(() => {
  drop();
  dropHover();
  dropCancelled();
});
</script>
