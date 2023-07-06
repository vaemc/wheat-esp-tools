<template>
  <a-config-provider :locale="locale">
    <!-- <Container /> -->
    <RouterView />
  </a-config-provider>
</template>
<script setup lang="ts">
import zhCN from "ant-design-vue/es/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";

dayjs.locale("zh-cn");

const locale = zhCN;
</script>
