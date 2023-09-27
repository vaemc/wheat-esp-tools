<template>
  <div style="padding: 10px">
    <SerialPortSelect />
    <a-button
      style="margin-right: 5px"
      v-for="item in list"
      @click="click(item.cmd)"
      >{{ item.name }}</a-button
    >
    <a-button style="margin-right: 5px" @click="readFlash()">读取固件</a-button>
  </div>
</template>
<script setup lang="ts">
import SerialPortSelect from "@/components/SerialPortSelect.vue";
import cli, { execute } from "@/utils/cli";
import { getCurrentDir, openFileInExplorer } from "@/utils/common";
import moment from "moment";
import { ref } from "vue";
const currentDir = await getCurrentDir();
const click = async (item: string[]) => {
  const port = localStorage.getItem("port") as string;
  execute(
    "esptool",
    item.map((x) => {
      if (x == "${port}") {
        return port;
      }
      return x;
    }) as string[]
  );

  const resultPromise = new Promise((resolve, reject) => {
    cli.on("stdout", (data) => {
      console.log(data);
    });
    cli.on("close", (data) => {
      console.log(data);
      cli.all.clear();
    });
  });
  const result = await resultPromise;
};

const readFlash = async () => {
  const port = localStorage.getItem("port") as string;
  let savePath = `${currentDir}\\firmware\\read-${moment().valueOf()}.bin`;
  execute("esptool", [
    "-p",
    port,
    "-b",
    "460800",
    "read_flash",
    "0",
    "ALL",
    savePath,
  ]);

  const resultPromise = new Promise((resolve, reject) => {
    cli.on("stdout", (data) => {
      if (String(data).includes("Hard resetting via RTS pin...")) {
        openFileInExplorer(savePath);
      }
    });
    cli.on("close", (data) => {
      console.log(data);
      cli.all.clear();
    });
  });
  const result = await resultPromise;
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
