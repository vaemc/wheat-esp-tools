<template>
  <a-button v-for="item in list" @click="click(item.cmd)" type="dashed" style=" margin: 5px">{{ item.name }}</a-button>
  <a-button type="dashed" @click="readFlash()" style=" margin: 5px">读取固件</a-button>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { selectedPort, executedCommand, getCurrentDir } from "../../common";
import { emit } from '@tauri-apps/api/event'
import moment from 'moment'

const currentDir = await getCurrentDir();
const click = (item: string[]) => {
  executedCommand(
    item.map((x) => {
      if (x == "${port}") {
        return selectedPort();
      }
      return x;
    }) as string[]
  );
};

const readFlash = () => {

  executedCommand(
    ["-p", selectedPort(), "-b", "460800", "read_flash", "0", "ALL", `${currentDir}\\firmware\\read-${moment().valueOf()}.bin`]
  );
}

const list = ref([
  { name: "擦除固件", cmd: ["-p", "${port}", "erase_flash"] },
  { name: "获取flash大小", cmd: ["-p", "${port}", "flash_id"] },

]);


function getRandomColor() {
  const colorList = [
    "pink",
    "red",
    "orange",
    "green",
    "cyan",
    "blue",
    "purple",
  ];

  const randomIndex = Math.floor(Math.random() * colorList.length);
  return colorList[randomIndex];
}
</script>
