<template>
  <a-popover
    trigger="hover"
    placement="leftTop"
    :title="$t('firmware.flashOption')"
    overlay-class-name="quick-flash-popover"
  >
    <template #content>
      <FlashOptionsBar
        v-model:baud-rate="baudRate"
        v-model:spi-mode="spiMode"
        v-model:erase-before-flash="eraseBeforeFlash"
        popover
      />
    </template>
    <a-button
      type="link"
      size="small"
      :loading="loading"
      @click="emit('flash', path)"
    >
      {{ $t("firmware.quickFlash") }}
    </a-button>
  </a-popover>
</template>
<script setup lang="ts">
import FlashOptionsBar from "./FlashOptionsBar.vue";

defineProps<{
  path: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  flash: [path: string];
}>();

const baudRate = defineModel<string>("baudRate", { required: true });
const spiMode = defineModel<string>("spiMode", { required: true });
const eraseBeforeFlash = defineModel<boolean>("eraseBeforeFlash", {
  required: true,
});
</script>
<style>
.quick-flash-popover .ant-popover-inner {
  padding: 8px 10px;
}
</style>
