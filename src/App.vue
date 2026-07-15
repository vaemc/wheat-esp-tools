<template>
  <a-config-provider
    :locale="antdLocale"
    :theme="{
      algorithm: theme.darkAlgorithm,
    }"
  >
    <RouterView />
    <SplashScreen />
  </a-config-provider>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { theme } from "ant-design-vue";
import zhCN from "ant-design-vue/es/locale/zh_CN";
import enUS from "ant-design-vue/es/locale/en_US";
import { useI18n } from "vue-i18n";
import SplashScreen from "@/components/SplashScreen.vue";

const { locale } = useI18n();
const antdLocale = computed(() => (locale.value === "zh" ? zhCN : enUS));
</script>
