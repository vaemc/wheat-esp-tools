<template>
  <SettingsItemRow
    :title="$t('settings.languageTitle')"
    :description="$t('settings.languageDesc')"
    tone="language"
  >
    <template #icon>
      <GlobalOutlined />
    </template>
    <a-select
      v-model:value="localeValue"
      size="small"
      style="width: 140px"
      :options="options"
      @change="onChange"
    />
  </SettingsItemRow>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { GlobalOutlined } from "@ant-design/icons-vue";
import { useI18n } from "vue-i18n";
import SettingsItemRow from "../../shared/components/SettingsItemRow.vue";

type AppLocale = "zh" | "en";

const { locale } = useI18n();
const localeValue = ref<AppLocale>(
  locale.value === "en" ? "en" : "zh"
);

const options = computed(() => [
  { value: "zh" as const, label: "中文" },
  { value: "en" as const, label: "English" },
]);

function onChange(value: AppLocale) {
  locale.value = value;
  localStorage.setItem("language", value);
  localeValue.value = value;
}
</script>
