<template>
  <div style="overflow: auto">
    <Popup :pathList="pathList" @remove="remove" />
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import Popup from "./Popup.vue";
import { historyPathStore } from "../utils/store";
import { Path } from "../utils/model";
const pathList = ref(historyPathStore().pathList as Path[]);
const remove = (path: string) => {
  historyPathStore().pathList = historyPathStore().pathList.filter(
    (x) => x.full !== path
  );
  pathList.value = historyPathStore().pathList;
};
</script>
