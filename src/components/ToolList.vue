<template>
  <a-card size="small" title="工具列表">
    <a-modal v-model:visible="modal.visible" :destroyOnClose="true" :footer="null" :maskClosable="true" :mask="false"
      :title="modal.title">
      <component :is="components.get(compName)"></component>
    </a-modal>

    <div style="overflow: auto">
      <div>
        <a-tag v-for="item in toolListConfig" style="cursor: pointer" :color="getRandomColor()"
          @click="openModal(item)">{{
            item.name }}</a-tag>
      </div>

    </div>
  </a-card>
</template>
<script setup lang="ts">
import { ref, defineAsyncComponent, markRaw } from "vue";

import { getToolListConfig } from "../utils/common";



const modal = ref({
  visible: false,
  title: ""
})

const components = ref(new Map<string, any>());
const compName = ref();

const toolListConfig = await getToolListConfig();



toolListConfig.map(item => {
  components.value.set(
    item.id,
    markRaw(defineAsyncComponent(() => import(`./tools/${item.id}.vue`)))
  );

})



function getRandomColor() {
  const colorList = ["pink", "red", "orange", "green", "cyan", "blue", "purple"]

  const randomIndex = Math.floor(Math.random() * colorList.length);
  return colorList[randomIndex];
}



const openModal = (item: any) => {
  modal.value.visible = true;
  modal.value.title = item.name;
  compName.value = item.id;
};




</script>

