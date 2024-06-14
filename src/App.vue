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
import { ref, onMounted } from "vue";
import { theme } from "ant-design-vue";
import zhCN from "ant-design-vue/es/locale/zh_CN";
import enUS from "ant-design-vue/es/locale/en_US";

let language = localStorage.getItem("language");
if (language == null) {
  language = "zh";
}

const locale = language === "zh" ? zhCN : enUS;
</script>
