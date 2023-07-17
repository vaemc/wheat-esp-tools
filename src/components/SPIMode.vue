<template>
  <a-tag color="#108ee9">SPI MODE</a-tag>
  <a-radio-group
    :value="modelValue"
    button-style="solid"
    style="margin-bottom: 5px"
    @change="$emit('update:modelValue', $event.target.value)"
    size="small"
  >
    <a-radio-button value="keep">keep</a-radio-button>
    <a-radio-button value="qio">qio</a-radio-button>
    <a-radio-button value="qout">qout</a-radio-button>
    <a-radio-button value="dio">dio</a-radio-button>
    <a-radio-button value="dout">dout</a-radio-button>
  </a-radio-group>
</template>

<script setup lang="ts">
defineProps(["modelValue"]);
defineEmits(["update:modelValue"]);
</script>
