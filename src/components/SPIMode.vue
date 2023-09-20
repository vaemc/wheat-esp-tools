<template>
  <a-tooltip>
    <template #title>SPI Mode</template>
    <a-segmented v-model:value="data" :options="options"
  /></a-tooltip>
  <!-- <a-tooltip>
    <template #title>烧录波特率</template>
    <a-segmented
      v-model:value="data"
      :options="['115200', '230400', '460800', '921600', '1152000', '1500000']"
  /></a-tooltip> -->

  <!-- <a-tooltip>
          <template #title>烧录波特率</template>
          <a-auto-complete
            style="width: 90%"
         
            size="small"
            placeholder="烧录波特率"
            :options="[
              { value: '115200' },
              { value: '230400' },
              { value: '460800' },
              { value: '921600' },
              { value: '1152000' },
              { value: '1500000' },
            ]"
        /></a-tooltip> -->

  <!-- <a-tag style="margin-left: 5px" color="#108ee9">BAUD</a-tag>
  <a-radio-group
    :value="modelValue"
    button-style="solid"
    style="margin-bottom: 5px"
    @change="$emit('update:modelValue', $event.target.value)"
    size="small"
  >
    <a-radio-button value="115200">115200</a-radio-button>
    <a-radio-button value="230400">230400</a-radio-button>
    <a-radio-button value="460800">460800</a-radio-button>
    <a-radio-button value="921600">921600</a-radio-button>
    <a-radio-button value="1152000">1152000</a-radio-button>
    <a-radio-button value="1500000">1500000</a-radio-button>
  </a-radio-group> -->
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
