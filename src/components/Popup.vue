<template>
  <a-list
    size="small"
    :pagination="{ pageSize: 5, size: 'small' }"
    bordered
    :data-source="pathList"
  >
    <template #renderItem="{ item }">
      <a-list-item
        ><template #actions>
          <a-popover title="SPI Mode">
            <template #content>
              <SPIMode v-model="selectedMode" />
            </template>
            <a @click="flash(item)">烧录</a>
          </a-popover>

          <a
            @click="
              () => {
                open(item);
              }
            "
            >打开</a
          >
          <a @click="remove(item.full)">删除</a> </template
        >{{ item.name }}</a-list-item
      >
    </template>
  </a-list>
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
const { pathList } = defineProps<{
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
