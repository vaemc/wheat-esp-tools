<template>
  <div class="flash-options-bar">
    <div class="flash-options-bar__fields">
      <div class="flash-options-bar__field flash-options-bar__field--spi">
        <SPIMode v-model="spiMode" />
      </div>
      <div class="flash-options-bar__field flash-options-bar__field--baud">
        <a-tooltip>
          <template #title>{{ $t("firmware.baudRate") }}</template>
          <a-auto-complete
            v-model:value="baudRate"
            class="baud-input"
            :placeholder="$t('firmware.baudRate')"
            :options="baudRateOptions"
          />
        </a-tooltip>
      </div>
      <div class="flash-options-bar__checks">
        <a-tooltip>
          <template #title>{{ $t("firmware.eraseFlashInfo") }}</template>
          <a-checkbox v-model:checked="eraseBeforeFlash">
            {{ $t("firmware.eraseFlash") }}
          </a-checkbox>
        </a-tooltip>
      </div>
    </div>
    <div v-if="$slots.actions" class="flash-options-bar__actions">
      <slot name="actions" />
    </div>
  </div>
</template>
<script setup lang="ts">
import SPIMode from "@/components/SPIMode.vue";
import { toBaudSelectOptions } from "@/composables/useFlashOptions";

const baudRate = defineModel<string>("baudRate", { required: true });
const spiMode = defineModel<string>("spiMode", { required: true });
const eraseBeforeFlash = defineModel<boolean>("eraseBeforeFlash", {
  required: true,
});

const baudRateOptions = toBaudSelectOptions();
</script>
<style scoped>
.flash-options-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 16px;
  width: 100%;
}

.flash-options-bar__fields {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px 16px;
  flex: 1;
  min-width: 0;
}

.flash-options-bar__field--spi {
  flex: 0 0 auto;
}

.flash-options-bar__field--spi :deep(.ant-segmented) {
  width: auto;
}

.flash-options-bar__field--baud {
  flex: 0 0 auto;
  min-width: 120px;
}

.baud-input {
  width: 140px;
}

.flash-options-bar__checks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.flash-options-bar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

:deep(.ant-checkbox-wrapper) {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
}
</style>
