<template>
  <div class="language-switch">
    <div class="language-switch-meta">
      <span class="language-switch-label">{{ $t("common.language") }}</span>
      <span class="language-switch-hint">{{ languageSelect ? "中文" : "English" }}</span>
    </div>
    <a-switch
      v-model:checked="languageSelect"
      size="small"
      @change="languageChange"
      checked-children="中"
      un-checked-children="EN"
    />
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import i18n from "@/locales/i18n";

const languageSelect = ref(i18n.global.locale.value === "zh");

const languageChange = (value: boolean) => {
  const locale = value ? "zh" : "en";
  i18n.global.locale.value = locale;
  localStorage.setItem("language", locale);
};
</script>
<style scoped>
.language-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.language-switch-meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.language-switch-label {
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.language-switch-hint {
  color: rgba(255, 255, 255, 0.82);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
}
</style>
