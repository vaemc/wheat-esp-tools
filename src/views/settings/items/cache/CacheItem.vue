<template>
  <SettingsItemRow
    :title="$t('settings.cacheTitle')"
    :description="desc"
    tone="cache"
  >
    <template #icon>
      <DeleteOutlined />
    </template>
    <a-button size="small" :loading="loading" @click="refresh">
      {{ $t("settings.refresh") }}
    </a-button>
    <a-button size="small" @click="openFolder">
      {{ $t("settings.openFolder") }}
    </a-button>
    <a-button
      size="small"
      danger
      :loading="clearing"
      :disabled="totalBytes === 0"
      @click="clearCache"
    >
      {{ $t("settings.cacheClear") }}
    </a-button>
  </SettingsItemRow>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { DeleteOutlined } from "@ant-design/icons-vue";
import SettingsItemRow from "../../shared/components/SettingsItemRow.vue";
import { useCacheCleanup } from "./useCacheCleanup";

const { t } = useI18n();
const {
  loading,
  clearing,
  totalBytes,
  sizeLabel,
  refresh,
  openFolder,
  clearCache,
} = useCacheCleanup();

const desc = computed(() =>
  loading.value
    ? t("settings.cacheScanning")
    : t("settings.cacheDesc", { size: sizeLabel.value })
);
</script>
