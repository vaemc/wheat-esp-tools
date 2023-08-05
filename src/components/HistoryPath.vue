<template>
  <div>
    <Popup :pathList="pathList" @remove="remove" />

    <!-- <a-list
      size="small"
      :pagination="{ pageSize: 5, size: 'small' }"
      bordered
      :data-source="pathList"
    >
      <template #renderItem="{ item }">
        <a-list-item
          ><template #actions>
            <a @click="flash(item.full)">烧录</a>
            <a
              @click="
                () => {
                  openFileInExplorer(item.full);
                }
              "
              >打开</a
            >
            <a @click="remove(item.full)">删除</a> </template
          >{{ item.full }}</a-list-item
        >
      </template>
    </a-list> -->
  </div>
</template>
<script setup lang="ts">
import Popup from "./Popup.vue";
import { message } from "ant-design-vue";
import {
  openFileInExplorer,
  isFile,
  selectedPort,
  getFlasherArgs,
} from "../utils/common";
import { Path } from "../utils/model";
import { ref } from "vue";
import { historyPathStore } from "../utils/store";
const pathList = ref(historyPathStore().pathList as Path[]);

const remove = (path: string) => {
  historyPathStore().pathList = historyPathStore().pathList.filter(
    (x) => x.full !== path
  );
  pathList.value = historyPathStore().pathList;
  message.success("删除成功!");
};

// const emit = defineEmits<{
//   (e: "flash", path: string): void;
// }>();

// async function generatedCommand(path: string) {
//   let cmd = [] as string[];
//   if (await isFile(path)) {
//     cmd = [
//       "-p",
//       selectedPort(),
//       "-b",
//       "1152000",
//       "write_flash",
//       "--flash_mode",
//       selectedMode.value,
//       "0x0",
//       path,
//     ];
//   } else {
//     let appInfo = await getFlasherArgs(path);
//     cmd = [
//       "--chip",
//       appInfo.chip,
//       "-p",
//       selectedPort(),
//       "-b",
//       "1152000",
//       "--before=default_reset",
//       "--after=hard_reset",
//       "write_flash",
//       ...appInfo.flashArgs,
//     ];
//   }
//   return cmd;
// }

// async function flash(path: string) {
//   console.log(await isFile(path));
// }
</script>
