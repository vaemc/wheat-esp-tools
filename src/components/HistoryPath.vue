<template>
  <a-card size="small" title="历史路径">
    <div style="overflow: auto" class="scroll">
      <a-popover
        v-for="item in historyPathList"
        :title="item.full"
        trigger="click"
      >
        <template #content>
          <a-button style="margin: 3px" @click="flash(item)"
            >烧录</a-button
          >
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
  </a-card>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { HistoryPath } from "../utils/model";
import { runCmd, generateCmd } from "../utils/esptool";
import { toolListConfig } from "../utils/tools-config";
import { historyPathStore } from "../utils/store";
import { openFileInExplorer } from "../utils/common";

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
  let cmd = [] as string[];
  if (item.name === "build") {
    cmd = (await generateCmd(toolListConfig[1].cmd, item.full)) as string[];
    runCmd(cmd);
    return;
  }
  cmd = (await generateCmd(toolListConfig[2].cmd, item.full)) as string[];
  runCmd(cmd);
}
</script>
