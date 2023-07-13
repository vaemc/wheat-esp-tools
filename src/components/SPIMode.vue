<template>
  <a-tag color="#108ee9">SPI MODE</a-tag>
  <a-radio-group
    v-model:value="spiMode"
    button-style="solid"
    style="margin-bottom: 5px"
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
import { ref } from "vue";
const spiMode = ref("keep");
</script>
