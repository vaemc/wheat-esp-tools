<template>
  <div style="display: flex;justify-content: center;">
    <a-input-search v-model:value="port" placeholder="端口号" enter-button="连接" @search="connect" />
  </div>
</template>
<script setup lang="ts">
import { json } from "stream/consumers";
import { ref } from "vue";
import {
  simpleSend
} from "../../utils/ws";
const port = ref();

const connect = async () => {
  simpleSend("ws://localhost:8686", JSON.stringify({ port: "COM3", baud: 74880 }))
}

const drop = (path: string | string[]) => {
  console.log(path);
};
const openFileDialog = (path: string | string[]) => {
  console.log(path);
};


</script>
