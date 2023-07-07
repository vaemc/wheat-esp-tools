<template>
  <div style="display: flex">
    <div style="flex: 1; margin-right: 5px">
      <a-card size="small" title="工具列表">
        <a-modal
          v-model:visible="modal.visible"
          :destroyOnClose="true"
          :footer="null"
          :maskClosable="true"
          :mask="false"
          :title="modal.title"
        >
        </a-modal>

        <div style="overflow: auto">
          <div>
            <!-- <a-tag
              v-for="item in pluginList"
              style="cursor: pointer; margin: 5px"
              :color="getRandomColor()"
              @click="openTool(item)"
              >{{ item }}</a-tag
            > -->

            <a-button
           
              style="margin: 5px"
              v-for="item in pluginList"
              @click="openTool(item)"
              >{{ item }}</a-button
            >
          </div>
        </div>
      </a-card>
    </div>
    <div style="flex: 1; margin-left: 5px">
      <a-card size="small" :title="toolName">
        <component :is="components.get(compName)"></component>
      </a-card>
    </div>
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
const toolName = ref("工具面板");

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

const openTool = (item: any) => {
  toolName.value = item;
  compName.value = item;
};
</script>
