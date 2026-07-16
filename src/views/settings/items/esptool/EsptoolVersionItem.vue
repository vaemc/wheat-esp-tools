<template>
  <SettingsItemRow
    :title="$t('settings.esptoolTitle')"
    :description="desc"
    tone="esptool"
  >
    <template #icon>
      <ToolOutlined />
    </template>
    <a-button size="small" :loading="loading" @click="refresh">
      {{ $t("settings.refresh") }}
    </a-button>
  </SettingsItemRow>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ToolOutlined } from "@ant-design/icons-vue";
import SettingsItemRow from "../../shared/components/SettingsItemRow.vue";
import { useEsptoolVersionItem } from "./useEsptoolVersion";

const { t } = useI18n();
const { loading, version, refresh } = useEsptoolVersionItem();

const desc = computed(() => {
  if (loading.value) {
    return t("settings.esptoolLoading");
  }
  if (version.value) {
    return t("common.esptoolVersion", { version: version.value });
  }
  return t("common.esptoolVersionUnknown");
});
</script>
