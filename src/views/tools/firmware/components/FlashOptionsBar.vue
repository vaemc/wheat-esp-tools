<template>
  <div class="flash-options" :class="{ 'flash-options--popover': popover }">
    <template v-if="popover">
      <div class="flash-options-field">
        <span class="flash-options-label">{{ $t("firmware.spiMode") }}</span>
        <SPIMode v-model="spiMode" plain />
      </div>
      <div class="flash-options-field">
        <span class="flash-options-label">{{ $t("firmware.baudRate") }}</span>
        <a-select
          v-model:value="baudRate"
          class="baud-select"
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
      <div class="flash-options-grid">
        <div class="flash-options-field flash-options-field--spi">
          <span class="flash-options-label">{{ $t("firmware.spiMode") }}</span>
          <SPIMode v-model="spiMode" />
        </div>
        <div class="flash-options-field flash-options-field--baud">
          <span class="flash-options-label">{{ $t("firmware.baudRate") }}</span>
          <a-select
            v-model:value="baudRate"
            class="baud-select"
            :options="baudRateOptions"
          />
        </div>
        <div class="flash-options-field flash-options-field--erase">
          <span class="flash-options-label">{{ $t("firmware.eraseOption") }}</span>
          <a-checkbox v-model:checked="eraseBeforeFlash">
            {{ $t("firmware.eraseFlash") }}
            <span class="flash-options-hint">{{ $t("firmware.eraseFlashInfo") }}</span>
          </a-checkbox>
        </div>
      </div>
    </template>
  </div>
</template>
<script setup lang="ts">
import SPIMode from "@/components/SPIMode.vue";
import { toBaudSelectOptions } from "@/composables/useFlashOptions";

defineProps<{
  popover?: boolean;
}>();

const baudRate = defineModel<string>("baudRate", { required: true });
const spiMode = defineModel<string>("spiMode", { required: true });
const eraseBeforeFlash = defineModel<boolean>("eraseBeforeFlash", {
  required: true,
});

const baudRateOptions = toBaudSelectOptions();
</script>
<style scoped>
.flash-options--popover {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.flash-options-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 36px;
}

.flash-options-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

/* 与固件烧录页一致：按内容撑开，避免 dout 被挤出 */
.flash-options-field--spi {
  flex: 0 0 auto;
}

.flash-options-field--spi :deep(.ant-segmented) {
  width: auto;
}

.flash-options-field--baud {
  flex: 0 0 auto;
}

.baud-select {
  width: 140px;
}

.flash-options-field--erase {
  flex: 0 1 auto;
}

.flash-options-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.erase-check {
  margin-left: 4px;
}

.flash-options-hint {
  margin-left: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
}

:deep(.ant-checkbox-wrapper) {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
}
</style>
