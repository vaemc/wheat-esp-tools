<template>
  <div style="overflow: auto">
    <a-popover
      v-for="item in pathList"
      :title="item.full"
      trigger="click"
    >
      <template #content>
        <view style="display: block">
          <SPIMode v-model="selectedMode" />
        </view>
        <view>
          <a-button style="margin: 3px" @click="flash(item)">烧录</a-button>
          <a-button style="margin: 3px" @click="open(item)" primary
            >打开</a-button
          >
          <a-button style="margin: 3px" @click="remove(item)" danger
            >删除</a-button
          >
        </view>
      </template>
      <a-button type="dashed" size="small" style="margin: 3px">{{
        item.name
      }}</a-button>
    </a-popover>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { message } from "ant-design-vue";
import SPIMode from "./SPIMode.vue";
import {
  executedCommand,
  openFileInExplorer,
  selectedPort,
  getFlasherArgs,
  isFile,
} from "../utils/common";
const selectedMode = ref("keep");
import { Path } from "../utils/model";
const {pathList} = defineProps<{
  pathList: Path[];
}>();

const emit = defineEmits<{
  (e: "remove", path: string): void;
}>();

async function flash(item: Path) {
  const result = await isFile(item.full);
  if (!result) {
    let appInfo = await getFlasherArgs(item.full);
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
      "--flash_mode",
      selectedMode.value,
      ...appInfo.flashArgs,
    ];
    executedCommand(cmd);
    return;
  }
  let cmd = [
    "-p",
    selectedPort(),
    "-b",
    "1152000",
    "write_flash",
    "--flash_mode",
    selectedMode.value,
    "0x0",
    item.full,
  ];
  executedCommand(cmd);
}

function open(item: Path) {
  openFileInExplorer(item.full);
}

async function remove(item: Path) {
  emit("remove", item.full);
  message.success("删除成功！");
}
</script>
