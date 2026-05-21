<template>
  <div class="language-switch">
    <span class="language-switch-label">{{ $t("common.language") }}</span>
    <a-switch
      v-model:checked="languageSelect"
      @change="languageChange"
      checked-children="中文"
      un-checked-children="EN"
    />
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from "vue";
import i18n from "@/locales/i18n";

const languageSelect = ref(true);

const languageChange = (value: boolean) => {
  i18n.global.locale.value = value ? "zh" : "en";
  localStorage.setItem("language", value ? "zh" : "en");
  location.reload();
};

onMounted(() => {
  const language = localStorage.getItem("language");
  languageSelect.value = language === "zh" || language == null;
});
</script>
<style scoped>
.language-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.language-switch-label {
  color: rgba(255, 255, 255, 0.65);
  font-size: 13px;
  white-space: nowrap;
}
</style>
