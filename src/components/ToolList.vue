<template>
  <a-card size="small" title="工具列表">
    <a-tabs @change="tabChange" :destroyInactiveTabPane="true">
      <a-tab-pane v-for="item in toolList" :tab="item" :key="item">
        <component :is="components.get(item)"></component>
      </a-tab-pane>
    </a-tabs>
  </a-card>
</template>
<script setup lang="ts">
import { ref, defineAsyncComponent, markRaw } from "vue";
import { balanced } from "../utils/balanced-match";

const toolList = Object.keys(import.meta.glob("./tools/*.vue")).map(
  (item) => {
    return balanced("./tools/", ".vue", item)?.body;
  }
);

const components = ref(new Map<string, any>());
const compName = ref();

toolList.map((item) => {
  components.value.set(
    item,
    markRaw(defineAsyncComponent(() => import(`./tools/${item}.vue`)))
  );
});

const tabChange = (item: any) => {
  compName.value = item;
};
</script>
