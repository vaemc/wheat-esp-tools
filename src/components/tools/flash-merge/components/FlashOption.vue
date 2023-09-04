<template>
  <a-tooltip>
    <template #title>烧录选项</template>
    <a-radio-group v-model:value="data" button-style="solid" style="margin-bottom: 5px" size="small">
      <a-radio-button :value="item.type" v-for="item in config" @click="change(item)">{{ item.type
      }}</a-radio-button>
    </a-radio-group>
  </a-tooltip>
</template>

<script setup lang="ts">
import { useVModel } from "@vueuse/core";
import { config } from "../"
import { Option } from "../model";

const props = defineProps<{
  modelValue: string;
}>();
const emit = defineEmits(["update:modelValue", "change"]);
const data = useVModel(props, "modelValue", emit);
const change = (item: Option) => {
  emit("change", item);
}

</script>
