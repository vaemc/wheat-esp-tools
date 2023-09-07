<template>
  <div style="margin: 5px 0">
    <SerialPortSelect />
  </div>
  <a-button v-for="item in list" @click="click(item.cmd)">{{
    item.name
  }}</a-button>
  <a-button @click="readFlash()">读取固件</a-button>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { executedCommand, getCurrentDir } from "@/utils/common";
import SerialPortSelect from "@/components/SerialPortSelect.vue";
import moment from "moment";
const currentDir = await getCurrentDir();
const click = (item: string[]) => {
  const port = localStorage.getItem("port") as string;
  executedCommand(
    item.map((x) => {
      if (x == "${port}") {
        return port;
      }
      return x;
    }) as string[]
  );
};

const readFlash = () => {
  const port = localStorage.getItem("port") as string;
  executedCommand([
    "-p",
    port,
    "-b",
    "460800",
    "read_flash",
    "0",
    "ALL",
    `${currentDir}\\firmware\\read-${moment().valueOf()}.bin`,
  ]);
};

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
