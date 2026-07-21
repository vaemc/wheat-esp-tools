<template>
  <SettingsItemRow
    :title="$t('settings.rememberWindowTitle')"
    :description="$t('settings.rememberWindowDesc')"
    tone="window"
  >
    <template #icon>
      <ExpandOutlined />
    </template>
    <a-switch
      v-model:checked="enabled"
      size="small"
      :loading="loading"
      @change="onChange"
    />
  </SettingsItemRow>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { message } from "ant-design-vue";
import { ExpandOutlined } from "@ant-design/icons-vue";
import { useI18n } from "vue-i18n";
import SettingsItemRow from "../../shared/components/SettingsItemRow.vue";

const { t } = useI18n();
const enabled = ref(true);
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    enabled.value = await invoke<boolean>("get_remember_window_state");
  } catch {
    enabled.value = true;
  } finally {
    loading.value = false;
  }
});

async function onChange(value: boolean) {
  loading.value = true;
  try {
    await invoke("set_remember_window_state", { enabled: value });
    enabled.value = value;
  } catch {
    enabled.value = !value;
    message.error(t("settings.rememberWindowSaveFailed"));
  } finally {
    loading.value = false;
  }
}
</script>
