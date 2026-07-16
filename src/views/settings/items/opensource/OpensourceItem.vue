<template>
  <SettingsItemRow
    :title="$t('settings.opensourceTitle')"
    :description="REPO_URL"
    tone="opensource"
  >
    <template #icon>
      <GithubOutlined />
    </template>
    <a-button size="small" type="primary" ghost @click="openHomepage">
      {{ $t("settings.opensourceOpen") }}
    </a-button>
  </SettingsItemRow>
</template>

<script setup lang="ts">
import { message } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import { open } from "@tauri-apps/plugin-shell";
import { GithubOutlined } from "@ant-design/icons-vue";
import SettingsItemRow from "../../shared/components/SettingsItemRow.vue";

const REPO_URL = "https://github.com/vaemc/wheat-esp-tools";

const { t } = useI18n();

async function openHomepage() {
  try {
    await open(REPO_URL);
  } catch (error) {
    console.error("[settings/opensource] open failed:", error);
    message.error(t("settings.opensourceOpenFailed"));
  }
}
</script>
