<template>
  <div class="flash-options" :class="{ 'flash-options--popover': popover }">
    <template v-if="popover">
      <div class="flash-options-field">
        <span class="flash-options-label">{{ $t("firmware.spiMode") }}</span>
        <SPIMode v-model="spiMode" plain />
      </div>
      <div class="flash-options-field">
        <span class="flash-options-label">{{ $t("firmware.baudRate") }}</span>
        <a-segmented
          v-model:value="baudRate"
          :options="baudRateOptions"
        />
      </div>
      <a-tooltip>
        <template #title>{{ $t("firmware.eraseFlashInfo") }}</template>
        <a-checkbox v-model:checked="eraseBeforeFlash" class="erase-check">
          {{ $t("firmware.eraseFlash") }}
        </a-checkbox>
      </a-tooltip>
    </template>
    <template v-else>
      <div class="flash-options-row">
        <span class="flash-options-label">{{ $t("firmware.spiMode") }}</span>
        <SPIMode v-model="spiMode" />
      </div>
      <div class="flash-options-row">
        <span class="flash-options-label">{{ $t("firmware.baudRate") }}</span>
        <a-segmented v-model:value="baudRate" :options="baudRateOptions" />
      </div>
      <a-checkbox v-model:checked="eraseBeforeFlash">
        {{ $t("firmware.eraseFlash") }}
        <span class="flash-options-hint">{{ $t("firmware.eraseFlashInfo") }}</span>
      </a-checkbox>
    </template>
  </div>
</template>
<script setup lang="ts">
import SPIMode from "@/components/SPIMode.vue";
import { BAUD_RATE_OPTIONS } from "@/composables/useFlashOptions";

defineProps<{
  popover?: boolean;
}>();

const baudRate = defineModel<string>("baudRate", { required: true });
const spiMode = defineModel<string>("spiMode", { required: true });
const eraseBeforeFlash = defineModel<boolean>("eraseBeforeFlash", {
  required: true,
});

const baudRateOptions = [...BAUD_RATE_OPTIONS];
</script>
<style scoped>
.flash-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 10px;
  margin-bottom: 8px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
}
.flash-options--popover {
  gap: 8px;
  margin: 0;
  padding: 0;
  background: transparent;
  border: none;
}
.flash-options-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.flash-options--popover .flash-options-label {
  font-size: 12px;
}
.flash-options-field :deep(.ant-segmented) {
  width: 100%;
}
.erase-check {
  margin-left: 4px;
}
.flash-options-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.flash-options-label {
  flex-shrink: 0;
  min-width: 48px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}
.flash-options-hint {
  margin-left: 2px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
}
:deep(.ant-checkbox-wrapper) {
  font-size: 12px;
}
</style>
