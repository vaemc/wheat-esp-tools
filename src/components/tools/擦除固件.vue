<template>
  <div style="height: 100%">
    <h1>擦除固件</h1>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { runCmd,generateCmd } from "../../utils/esptool";

const cmd = ["-p", "${port}", "erase_flash"];
runCmd((await generateCmd(cmd)) as string[]);
const openFileDialog = async () => {};
</script>
