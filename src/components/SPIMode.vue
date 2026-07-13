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
import { useVModel } from "@vueuse/core";
import { reactive } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = defineProps<{
  modelValue: string;
  /** 由外部标签说明时，不包 tooltip */
  plain?: boolean;
}>();
const emit = defineEmits(["update:modelValue"]);

const data = useVModel(props, "modelValue", emit);
const options = reactive(["keep", "qio", "qout", "dio", "dout"]);
</script>
<style scoped>
.spi-mode :deep(.ant-segmented) {
  width: 100%;
}
</style>
