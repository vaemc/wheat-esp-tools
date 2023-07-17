<template>
  <a-radio-group
    v-model:value="option"
    style="margin-bottom: 5px"
    button-style="solid"
    size="small"
  >
    <a-radio-button value="flash">烧录</a-radio-button>
    <a-radio-button value="merge">合并</a-radio-button>
  </a-radio-group>

  <Upload
    title="选择或者拖拽文件到此"
    subtitle="合并build目录的固件"
    :isDirectory="true"
    :isMultiple="false"
    @open="uploadHandle"
    @drop="uploadHandle"
  />
</template>
<script setup lang="ts">
import { ref } from "vue";
import {
  selectedPort,
  executedCommand,
  getFlasherArgs,
  getCurrentDir,
  openFileInExplorer,
  addHistoryPath,
} from "../../utils/common";
const currentDir = await getCurrentDir();
const option = ref("flash");
async function generatedCommand(data: any) {
  const { path } = data;
  let appInfo = await getFlasherArgs(path);
  if (option.value == "flash") {
    let cmd = [
      "--chip",
      appInfo.chip,
      "-p",
      selectedPort(),
      "-b",
      "1152000",
      "--before=default_reset",
      "--after=hard_reset",
      "write_flash",
      ...appInfo.flashArgs,
    ];
    executedCommand(cmd);
  } else {
    let cmd = [
      "--chip",
      appInfo.chip,
      "merge_bin",
      "-o",
      `${currentDir}\\firmware\\${appInfo.appName}.bin`,
      ...appInfo.flashArgs,
    ];
    executedCommand(cmd);
    await new Promise((r) => setTimeout(r, 2500));
    openFileInExplorer(`${currentDir}\\firmware\\${appInfo.appName}.bin`);
  }

  addHistoryPath(path);
}

const uploadHandle = (path: String | String[]) => {
  generatedCommand({ path: path });
};
</script>
