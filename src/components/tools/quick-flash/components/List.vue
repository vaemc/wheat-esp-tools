<template>
  <a-list
    size="small"
    :pagination="{ pageSize: 10, size: 'small' }"
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
            <a @click="flash(item.full)">烧录</a>
          </a-popover>

         <a-tooltip>
            <template #title>在资源管理器中打开</template>
            <a
              @click="
                () => {
                  openFileInExplorer(item.full)
                }
              "
              >打开</a
            >
          </a-tooltip>
          <a @click="remove(item.full)">删除</a> </template
        >{{ item.name }}</a-list-item
      >
    </template>
  </a-list>
</template>
<script setup lang="ts">
import { ref } from "vue";
import SPIMode from "../../SPIMode.vue";
import {
  executedCommand,
  openFileInExplorer,
  selectedPort,
  getFlasherArgs,
  isFile,
} from "../../../common";
const selectedMode = ref("keep");
import { Path } from "../../model";
const { pathList } = defineProps<{
  pathList: Path[];
}>();

const emit = defineEmits<{
  (e: "remove", path: string): void;
}>();

async function flash(path: string) {
  console.log(path);
  
  // const result = await isFile(path);
  // if (!result) {
  //   let appInfo = await getFlasherArgs(path);
  //   let cmd = [
  //     "--chip",
  //     appInfo.chip,
  //     "-p",
  //     selectedPort(),
  //     "-b",
  //     "1152000",
  //     "--before=default_reset",
  //     "--after=hard_reset",
  //     "write_flash",
  //     "--flash_mode",
  //     selectedMode.value,
  //     ...appInfo.flashArgs,
  //   ];
  //   executedCommand(cmd);
  //   return;
  // }
  // let cmd = [
  //   "-p",
  //   selectedPort(),
  //   "-b",
  //   "1152000",
  //   "write_flash",
  //   "--flash_mode",
  //   selectedMode.value,
  //   "0x0",
  //   path,
  // ];
  // executedCommand(cmd);
}

async function remove(path: string) {
  emit("remove", path);
}
</script>
