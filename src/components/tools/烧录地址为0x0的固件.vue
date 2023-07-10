<template>
  <div style="height: 100%">
    <Upload
      title="选择或者拖拽文件到此"
      subtitle="烧录地址为0x0的固件"
      :isDirectory="false"
      :isMultiple="false"
      @openFileDialog="openFileDialog"
      @drop="drop"
    />
  </div>
</template>
<script setup lang="ts">
import { selectedPort,executedCommand } from "../../utils/common";
function generatedCommand(data: any) {
  const { path } = data;
  let cmd = ["-p", selectedPort(), "-b", "1152000", "write_flash", "0x0", path];
  executedCommand(cmd);
}

const drop = (path: String | String[]) => {
  generatedCommand({ path: path });
};

const openFileDialog = (path: String | String[]) => {
  generatedCommand({ path: path });
};
</script>
