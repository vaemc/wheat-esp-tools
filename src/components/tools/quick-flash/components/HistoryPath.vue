<template>
  <div style="margin: 5px">
    <a-input-search
      style="margin: 5px 0"
      placeholder=""
      enter-button
      @search="onSearch"
    />
    <List :pathList="pathList" @remove="remove" />
  </div>
</template>
<script setup lang="ts">
import List from "./List.vue";
import { message } from "ant-design-vue";
import { Path } from "../../model";
import { ref } from "vue";
// const pathList = ref(historyPathStore().pathList as Path[]);
const remove = (path: string) => {
  // historyPathStore().pathList = historyPathStore().pathList.filter(
  //   (x) => x.full !== path
  // );
  // pathList.value = historyPathStore().pathList;
  // message.success("删除成功!");
};

const onSearch = (text: string) => {
  // if (text == "") {
  //   pathList.value = historyPathStore().pathList;
  // } else {
  //   pathList.value = pathList.value.filter((x) =>
  //     x.full.toLowerCase().includes(text.toLowerCase())
  //   );
  // }
};
</script>
