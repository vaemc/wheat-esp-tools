<template>
  <SettingsItemRow
    :title="$t('settings.autostartTitle')"
    :description="$t('settings.autostartDesc')"
    tone="autostart"
  >
    <template #icon>
      <PoweroffOutlined />
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
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { message } from "ant-design-vue";
import { PoweroffOutlined } from "@ant-design/icons-vue";
import { useI18n } from "vue-i18n";
import SettingsItemRow from "../../shared/components/SettingsItemRow.vue";

const { t } = useI18n();
const enabled = ref(false);
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    enabled.value = await isEnabled();
  } catch {
    enabled.value = false;
  } finally {
    loading.value = false;
  }
});

async function onChange(value: boolean) {
  loading.value = true;
  try {
    if (value) {
      await enable();
    } else {
      await disable();
    }
    enabled.value = value;
  } catch {
    enabled.value = !value;
    message.error(t("settings.autostartSaveFailed"));
  } finally {
    loading.value = false;
  }
}
</script>
