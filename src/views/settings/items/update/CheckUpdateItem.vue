<template>
  <div class="update-stack">
    <SettingsItemRow
      :title="$t('settings.versionTitle')"
      :description="versionDesc"
      tone="version"
    >
      <template #icon>
        <TagOutlined />
      </template>
      <a-button size="small" :loading="loadingVersion" @click="loadCurrentVersion">
        {{ $t("settings.refresh") }}
      </a-button>
    </SettingsItemRow>

    <SettingsItemRow
      :title="$t('settings.updateTitle')"
      :description="statusText"
      tone="update"
    >
      <template #icon>
        <CloudSyncOutlined />
      </template>
      <a-button
        v-if="result?.hasUpdate && !installing"
        size="small"
        type="primary"
        :disabled="checking"
        @click="upgradeNow"
      >
        {{ $t("settings.updateUpgrade") }}
      </a-button>
      <a-button
        size="small"
        type="primary"
        ghost
        :loading="checking || installing"
        :disabled="installing"
        @click="checkUpdate"
      >
        {{ $t("settings.updateCheck") }}
      </a-button>
    </SettingsItemRow>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { CloudSyncOutlined, TagOutlined } from "@ant-design/icons-vue";
import SettingsItemRow from "../../shared/components/SettingsItemRow.vue";
import { useUpdateCheck } from "./useUpdateCheck";

const { t } = useI18n();
const {
  loadingVersion,
  checking,
  installing,
  currentVersion,
  result,
  statusText,
  loadCurrentVersion,
  checkUpdate,
  upgradeNow,
} = useUpdateCheck();

const versionDesc = computed(() => {
  if (loadingVersion.value && !currentVersion.value) {
    return t("settings.versionLoading");
  }
  return t("settings.versionDesc", { version: currentVersion.value || "—" });
});
</script>

<style scoped>
.update-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
