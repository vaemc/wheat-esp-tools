<template>
  <div style="height: 100%">
    <a-tag
      v-for="item in list"
      style="cursor: pointer; margin: 5px"
      :color="getRandomColor()"
      >{{ item }}</a-tag
    >
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { runCmd, generateCmd } from "../../utils/esptool";

// const cmd = ["-p", "${port}", "erase_flash"];
// runCmd((await generateCmd(cmd)) as string[]);

const list = ref(["擦除固件", "获取flash大小"]);

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
