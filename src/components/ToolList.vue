<template>
  <div style="display: flex;">
    <div style="flex: 1;margin-right: 5px;">
      <a-card size="small" title="工具列表">
        <a-modal v-model:visible="modal.visible" :destroyOnClose="true" :footer="null" :maskClosable="true" :mask="false"
          :title="modal.title">

        </a-modal>

        <div style="overflow: auto">
          <div>
            <a-tag v-for="item in toolListConfig" style="cursor: pointer;margin: 5px;" :color="getRandomColor()"
              @click="openModal(item)">{{
                item.name }}</a-tag>
          </div>

        </div>
      </a-card>
    </div>
    <div style="flex: 1;margin-left: 5px;">
      <a-card size="small" :title="toolName">
        <component :is="components.get(compName)"></component>
      </a-card>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, defineAsyncComponent, markRaw } from "vue";

import { getToolListConfig } from "../utils/common";



const modal = ref({
  visible: false,
  title: ""
})
const toolName = ref("工具面板");



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
  // modal.value.visible = true;
  toolName.value = item.name;
  compName.value = item.id;
};




</script>

