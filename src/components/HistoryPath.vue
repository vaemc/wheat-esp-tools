<template>
  <div style="overflow: auto" class="scroll">
    <a-popover
      v-for="item in historyPathList"
      :title="item.full"
      trigger="click"
    >
      <template #content>
        <a-button style="margin: 3px" @click="flash(item)">烧录</a-button>
        <a-button style="margin: 3px" @click="open(item)" primary
          >打开</a-button
        >
        <a-button style="margin: 3px" @click="remove(item)" danger
          >删除</a-button
        >
      </template>
      <a-button type="dashed" size="small" style="margin: 3px">{{
        item.ellipsis
      }}</a-button>
    </a-popover>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { HistoryPath } from "../utils/model";
import { historyPathStore } from "../utils/store";
import {
  executedCommand,
  selectedPort,
  openFileInExplorer,
  getFlasherArgs,
} from "../utils/common";

const historyPathList = ref(historyPathStore().pathList as HistoryPath[]);

function remove(item: HistoryPath) {
  historyPathStore().pathList = historyPathList.value.filter(
    (x) => x.full !== item.full
  );
  historyPathList.value = historyPathStore().pathList;
}

function open(item: HistoryPath) {
  if (item.name === "build") {
    openFileInExplorer(item.full);
    return;
  }
  openFileInExplorer(item.full.slice(0, item.full.length - item.name.length));
}

async function flash(item: HistoryPath) {
  if (item.name === "build") {
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
      ...appInfo.flashArgs,
    ];
    executedCommand(cmd);
    return;
  }
  let cmd = ["-p", selectedPort(), "-b", "1152000", "write_flash", "0x0", item.full];
  executedCommand(cmd);
}
</script>
