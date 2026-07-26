<template>
  <div class="spi-mode">
    <a-tooltip v-if="!plain">
      <template #title>{{ t("firmware.spiMode") }}</template>
      <a-segmented v-model:value="data" :options="options" />
    </a-tooltip>
    <a-segmented v-else v-model:value="data" :options="options" />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = defineProps<{
  modelValue: string;
  /** 由外部标签说明时，不包 tooltip */
  plain?: boolean;
}>();
const emit = defineEmits(["update:modelValue"]);

const data = computed({
  get: () => props.modelValue,
  set: (value: string) => emit("update:modelValue", value),
});
const options = reactive(["qio", "qout", "dio", "dout"]);

// 旧值 keep / 未知值 → espflash 默认 dio
if (!options.includes(props.modelValue)) {
  emit("update:modelValue", "dio");
}
</script>
<style scoped>
.spi-mode :deep(.ant-segmented) {
  width: 100%;
}
</style>
