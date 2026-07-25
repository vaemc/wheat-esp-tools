<template>
  <SettingsItemRow
    v-if="isWindows"
    :title="$t('settings.taskbarComTitle')"
    :description="$t('settings.taskbarComDesc')"
    tone="taskbar"
  >
    <template #icon>
      <UsbOutlined />
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
import { UsbOutlined } from "@ant-design/icons-vue";
import { useI18n } from "vue-i18n";
import SettingsItemRow from "../../shared/components/SettingsItemRow.vue";

const { t } = useI18n();
const isWindows = ref(false);
const enabled = ref(false);
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    isWindows.value = await invoke<boolean>("is_windows_platform");
    if (!isWindows.value) {
      return;
    }
    enabled.value = await invoke<boolean>("get_taskbar_com_ports_enabled");
  } catch {
    isWindows.value = false;
    enabled.value = false;
  } finally {
    loading.value = false;
  }
});

async function onChange(value: boolean) {
  loading.value = true;
  try {
    await invoke("set_taskbar_com_ports_enabled", { enabled: value });
    enabled.value = value;
  } catch {
    enabled.value = !value;
    message.error(t("settings.taskbarComSaveFailed"));
  } finally {
    loading.value = false;
  }
}
</script>
