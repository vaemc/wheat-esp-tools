<template>
  <a-card size="small" title="工具列表">
    <a-tabs @change="tabChange">
      <a-tab-pane v-for="item in components" :tab="item.name" :key="item.name">
        <component :drop="item.drop" :is="item.component"></component>
      </a-tab-pane>
      <a-tab-pane tab="历史操作" key="1"><HistoryPath /> </a-tab-pane>
      <a-tab-pane tab="快捷烧录" key="2"><FirmwareList /> </a-tab-pane>
    </a-tabs>
  </a-card>
</template>
<script setup lang="ts">
import { ref, defineAsyncComponent, markRaw } from "vue";
import { balanced } from "../utils/balanced-match";
import { usePrevious } from "@vueuse/core";
import FirmwareList from "./FirmwareList.vue";
import HistoryPath from "./HistoryPath.vue";

const toolList = Object.keys(import.meta.glob("./tools/*.vue")).map((item) => {
  return balanced("./tools/", ".vue", item)?.body;
});
const components = ref([] as { name: string; component: any; drop: boolean }[]);
const compName = ref();
const previousCompName = usePrevious(compName);

toolList.map((item) => {
  components.value.push({
    name: item,
    component: markRaw(
      defineAsyncComponent(() => import(`./tools/${item}.vue`))
    ),
    drop: true,
  });
});

const tabChange = (item: any) => {
  if (item == "1" || item == "2") {
    return;
  }
  compName.value = item;
  if (previousCompName.value != undefined) {
    components.value.map((x) => {
      if (x.name == previousCompName.value) {
        x.drop = false;
      }
      if (x.name == item) {
        x.drop = true;
      }
    });
  }
};
</script>
