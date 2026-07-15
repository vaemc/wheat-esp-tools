<template>
  <div class="partition-page">
    <header class="mode-bar">
      <a-segmented
        v-model:value="activeMode"
        :options="modeOptions"
      />
      <p class="mode-hint">{{ modeHint }}</p>
    </header>

    <div class="mode-body">
      <PartitionDevicePanel v-show="activeMode === 'device'" />
      <PartitionAlignPanel v-show="activeMode === 'align'" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import PartitionAlignPanel from "./components/PartitionAlignPanel.vue";
import PartitionDevicePanel from "./components/PartitionDevicePanel.vue";

const { t } = useI18n();
const activeMode = ref<"device" | "align">("device");

const modeOptions = computed(() => [
  { label: t("partition.tabDevice"), value: "device" },
  { label: t("partition.tabAlign"), value: "align" },
]);

const modeHint = computed(() =>
  activeMode.value === "device"
    ? t("partition.deviceHint")
    : t("partition.alignModeHint")
);
</script>
<style scoped>
.partition-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  padding: 12px 16px;
}

.mode-bar {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}

.mode-hint {
  margin: 0;
  flex: 1;
  min-width: 200px;
  font-size: 12px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.45);
}

.mode-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.mode-body > :deep(*) {
  height: 100%;
}
</style>
