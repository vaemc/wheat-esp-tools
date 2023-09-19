<template>
  <a-config-provider
    :locale="locale"
    :theme="{
      algorithm: theme.darkAlgorithm,
    }"
  >
    <Suspense>
      <RouterView />
    </Suspense>
  </a-config-provider>
</template>
<script setup lang="ts">
import { theme } from "ant-design-vue";
import zhCN from "ant-design-vue/es/locale/zh_CN";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";

dayjs.locale("zh-cn");

const locale = zhCN;
</script>
