<template>
  <a-tag v-for="item in list" @click="click(item.cmd)" style="cursor: pointer; margin: 5px" :color="getRandomColor()">{{
    item.name }}</a-tag>
  <a-tag @click="readFlash()" style="cursor: pointer; margin: 5px" :color="getRandomColor()">读取固件</a-tag>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { selectedPort, executedCommand, getCurrentDir } from "../../utils/common";
import { emit, listen } from '@tauri-apps/api/event'
import moment from 'moment'
import { terminalWrite, terminalWriteLine } from "../../utils/bus";
import kleur from "kleur";

const currentDir = await getCurrentDir();
defineProps(["drop"]);
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
  emit('read_flash',
    ["-p", selectedPort(), "-b", "460800", "read_flash", "0", "ALL", `${currentDir}\\firmware\\read-${moment().valueOf()}.bin`],
  )
}

const list = ref([
  { name: "擦除固件", cmd: ["-p", "${port}", "erase_flash"] },
  { name: "获取flash大小", cmd: ["-p", "${port}", "flash_id"] },
  { name: "AAAAAAAA", cmd: ["-p", "${port}", "-b", "460800", "read_flash", "0", "ALL", `${currentDir}\\firmware\\read-${moment().valueOf()}.bin`] },
]);

await listen('read_flash_output', (event) => {
  terminalWrite(
    kleur.bold().blue(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] `)
  );
  terminalWriteLine(String(event.payload));

})


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
