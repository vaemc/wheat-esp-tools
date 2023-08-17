<template>
  <a-tag
    v-for="item in list"
    @click="click(item.cmd)"
    style="cursor: pointer; margin: 5px"
    :color="getRandomColor()"
    >{{ item.name }}</a-tag
  >
</template>
<script setup lang="ts">
import { ref } from "vue";
import { selectedPort, executedCommand } from "../../utils/common";
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
