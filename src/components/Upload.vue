<template>
  <div>
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
import { open } from "@tauri-apps/api/dialog";

const dropBoxClass = ref("dropBox");

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  isDirectory: { type: Boolean, default: false },
  isMultiple: { type: Boolean, default: false },
});

const emit = defineEmits<{
  (e: "openFileDialog", path: String | String[]): void;
  (e: "drop", path: String | String[]): void;
  (e: "dropHoverDrop", {}): void;
  (e: "dropCancelled", {}): void;
}>();

const openFileDialog = async () => {
  const selected = await open({
    directory: props.isDirectory,
    multiple: props.isMultiple,
  });

  if (selected !== null) {
    emit("openFileDialog", selected);
  }
};

const drop = await listen("tauri://file-drop", (event: any) => {
  dropBoxClass.value = "dropBox";
  if (event.payload.length == 1) {
    emit("drop", event.payload[0]);
  } else {
    emit("drop", event.payload);
  }
});

const dropHover = await listen("tauri://file-drop-hover", (event: any) => {
  dropBoxClass.value = "dropBoxHover";

  emit("dropHoverDrop", "ok");
});

const dropCancelled = await listen("tauri://file-drop-cancelled", () => {
  dropBoxClass.value = "dropBox";

  emit("dropCancelled", "ok");
});

onBeforeUnmount(() => {
  drop();
  dropHover();
  dropCancelled();
});
</script>
<style>
.dropBox {
  width: 100%;
  height: 120px;
  border: 1px dashed #434343;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: all ease 0.5s;
  /* transition: 0.5s ease; */
}

.dropBox:hover {
  width: 100%;
  height: 120px;
  border: 1px dashed #177ddc;
  cursor: pointer;
  transition: all ease 1s;
}

.dropBoxHover {
  width: 100%;
  height: 120px;
  border: 1px dashed #177ddc;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: all ease 1s;
}
</style>
