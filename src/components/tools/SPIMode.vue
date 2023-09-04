<template>
  <a-tooltip>
    <template #title>SPI Mode</template>
    <a-radio-group :value="modelValue" button-style="solid" style="margin-bottom: 5px"
      @change="$emit('update:modelValue', $event.target.value)" size="small">
      <a-radio-button value="keep">keep</a-radio-button>
      <a-radio-button value="qio">qio</a-radio-button>
      <a-radio-button value="qout">qout</a-radio-button>
      <a-radio-button value="dio">dio</a-radio-button>
      <a-radio-button value="dout">dout</a-radio-button>
    </a-radio-group>
  </a-tooltip>

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
defineProps(["modelValue"]);
defineEmits(["update:modelValue"]);
</script>
