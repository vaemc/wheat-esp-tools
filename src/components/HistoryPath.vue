<template>
  <div>
    <List :pathList="pathList" @remove="remove" />
  </div>
</template>
<script setup lang="ts">
import List from "./List.vue";
import { message } from "ant-design-vue";
import { Path } from "../utils/model";
import { ref } from "vue";
import { historyPathStore } from "../utils/store";
const pathList = ref(historyPathStore().pathList as Path[]);
const remove = (path: string) => {
  historyPathStore().pathList = historyPathStore().pathList.filter(
    (x) => x.full !== path
  );
  pathList.value = historyPathStore().pathList;
  message.success("删除成功!");
};
</script>
