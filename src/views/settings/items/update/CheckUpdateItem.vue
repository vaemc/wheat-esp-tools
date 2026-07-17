<template>
  <SettingsItemRow
    :title="$t('settings.versionTitle')"
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
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { CloudSyncOutlined } from "@ant-design/icons-vue";
import SettingsItemRow from "../../shared/components/SettingsItemRow.vue";
import { useUpdateStore } from "@/stores/update";

const updateStore = useUpdateStore();
const { checking, installing, result, statusText } = storeToRefs(updateStore);
const { loadCurrentVersion, checkUpdate, upgradeNow } = updateStore;

onMounted(() => {
  void loadCurrentVersion();
});
</script>
