<template>
  <a-config-provider
    :locale="locale"
    :theme="{
      algorithm: theme.darkAlgorithm,
    }"
  >
    <RouterView />
    <SplashScreen v-if="showSplash" @done="showSplash = false" />
  </a-config-provider>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { theme } from "ant-design-vue";
import zhCN from "ant-design-vue/es/locale/zh_CN";
import enUS from "ant-design-vue/es/locale/en_US";
import SplashScreen from "@/components/SplashScreen.vue";

let language = localStorage.getItem("language");
if (language == null) {
  language = "zh";
}

const locale = language === "zh" ? zhCN : enUS;
const showSplash = ref(true);
</script>
