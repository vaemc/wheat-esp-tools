<template>
  <div>
    <a-tabs @change="tabChange" :destroyInactiveTabPane="true">
      <a-tab-pane v-for="item in pluginList" :tab="item" :key="item">
        <component :is="components.get(item)"></component>
      </a-tab-pane>

    </a-tabs>
  </div>
</template>
<script setup lang="ts">
import { ref, defineAsyncComponent, markRaw } from "vue";
import { Plugin } from "../utils/model";
// import { getPluginList } from "../utils/common";
import { convertFileSrc } from "@tauri-apps/api/tauri";

const pluginList = [
  "擦除固件",
  "合并多个固件",
  "合并build目录的固件",
  "获取flash大小",
  "烧录地址为0x0的固件",
  "烧录多个固件",
  "烧录build目录的固件",
];

const modal = ref({
  visible: false,
  title: "",
});

const components = ref(new Map<string, any>());
const compName = ref();

pluginList.map((item) => {
  components.value.set(
    item,
    markRaw(defineAsyncComponent(() => import(`./tools/${item}.vue`)))
  );
});

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



const tabChange = (item: any) => {
  console.log(item);

  compName.value = item;
};



</script>
