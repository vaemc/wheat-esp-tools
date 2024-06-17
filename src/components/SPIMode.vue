<template>
  <a-tooltip>
    <template #title>SPI Mode</template>
    <a-segmented v-model:value="data" :options="options" />
  </a-tooltip>
</template>

<script setup lang="ts">
import { useVModel } from "@vueuse/core";
import { reactive, ref } from "vue";
const props = defineProps<{
  modelValue: string;
}>();
const emit = defineEmits(["update:modelValue"]);

const data = useVModel(props, "modelValue", emit);

// defineProps(["modelValue"]);
// defineEmits(["update:modelValue"]);
const options = reactive(["keep", "qio", "qout", "dio", "dout"]);
// const value = ref(data[0]);
</script>
