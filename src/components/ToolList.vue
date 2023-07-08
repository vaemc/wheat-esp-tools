<template>
  <a-card size="small" title="工具列表">
    <a-tabs @change="tabChange" :destroyInactiveTabPane="true">
      <a-tab-pane v-for="item in pluginList" :tab="item" :key="item">
        <component :is="components.get(item)"></component>
      </a-tab-pane>
    </a-tabs>
  </a-card>
</template>
<script setup lang="ts">
import { ref, defineAsyncComponent, markRaw } from "vue";

const pluginList = [
  "合并build目录的固件",
  "烧录地址为0x0的固件",
  "合并或烧录固件",
  "烧录build目录的固件",
  "读取固件",
  "其他功能",
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
