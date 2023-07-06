<template>
  <a-card size="small" title="工具列表">
    <a-modal v-model:visible="visible" :maskClosable="false" title="Basic Modal">
      <component :is="components.get(compName)"></component>
    </a-modal>

    <div style="overflow: auto">
      <div>
        <a-tag style="cursor: pointer" color="pink" @click="aaa"
          >合并build目录的固件</a-tag
        >
        <a-tag style="cursor: pointer" color="red" @click="bbb"
          >烧录build目录的固件</a-tag
        >
        <a-tag style="cursor: pointer" color="orange"
          >烧录地址为0x0的固件</a-tag
        >
        <a-tag style="cursor: pointer" color="green">擦除固件</a-tag>
        <a-tag style="cursor: pointer" color="cyan">获取flash大小</a-tag>
        <a-tag style="cursor: pointer" color="blue">烧录固件到指定地址</a-tag>
        <a-tag style="cursor: pointer" color="purple">合并自定义地址固件</a-tag>
      </div>
    </div>
  </a-card>
</template>
<script setup lang="ts">
import SimpleToolList from "./SimpleToolList.vue";
import { ref, onMounted, h, defineAsyncComponent, markRaw } from "vue";
import { message } from "ant-design-vue";
import { runCmd, generateCmd } from "../utils/esptool";

import { getToolListConfig, getCurrentDir } from "../utils/common";
import { open } from "@tauri-apps/api/dialog";
import { historyPathStore } from "../utils/store";
import { HistoryPath, ToolConfig } from "../utils/model";
import {
  chipTypeList as ct,
  mergeCustomFirmwareToolID,
} from "../utils/tools-config";
import emitter from "../utils/bus";
import moment from "moment";

const visible = ref(false);

const components = ref(new Map<string, any>());
components.value.set(
  "MyTag",
  markRaw(defineAsyncComponent(() => import("./tools/A0001.vue")))
);

components.value.set(
  "MyTag2",
  markRaw(defineAsyncComponent(() => import("./tools/A0002.vue")))
);

const compName = ref("MyTag");

const currentDir = await getCurrentDir();
const dropBoxClass = ref("dropBox");
const tabSelect = ref({} as ToolConfig);
const toolsRadio = ref();
const chipModalVisible = ref(false);
const chipTypeList = ref(ct);
const customFlashAddress = ref("");
const chipType = ref();
chipType.value = chipTypeList.value[0];
const toolListConfig = await getToolListConfig();

const aaa = () => {
  visible.value = true;
  compName.value = "MyTag";
};

const bbb = () => {
  visible.value = true;
  compName.value = "MyTag2";
};

const chipModalClick = (item: string) => {
  emitter.emit("chipModal", item);
};

function historyPathSave(data: string) {
  let path = data.split("\\");
  let result = {} as HistoryPath;
  if (path.length >= 5) {
    let temp = `${path[0]}\\${path[1]}\\${path[2]}\\...\\${
      path[path.length - 2]
    }\\${path[path.length - 1]}`;
    result = { full: data, ellipsis: temp, name: path[path.length - 1] };
  } else {
    result = { full: data, ellipsis: data, name: path[path.length - 1] };
  }
  let historyPathList = historyPathStore().pathList;
  if (historyPathList.filter((x) => x.full === result.full).length == 0) {
    historyPathStore().pathList.push(result);
  }
}

function mergeCustomFirmware(pathList: any) {
  if (pathList.length < 2) {
    message.warning("最少需要选择两个文件");
    return;
  }

  const flattenedList = pathList
    .map((item: string) => {
      let address = [...item.split("_")].pop()?.split(".")[0];
      return [address, item];
    })
    .reduce((accumulator: string, currentValue: string) => {
      return accumulator.concat(currentValue);
    }, []);

  new Promise((resolve) => {
    chipModalVisible.value = true;
    emitter.on("chipModal", (data) => {
      resolve(data);
    });
  }).then((data) => {
    let cmd = [
      "--chip",
      data,
      "merge_bin",
      "-o",
      `${currentDir}\\firmware\\merge_bin_${data}_${moment().format(
        "YYYYMMDDHHmmss"
      )}.bin`,
      ...flattenedList,
    ];
    console.log(cmd);
    chipModalVisible.value = false;
    runCmd(cmd);
  });
}

//const toolListConfig = ref();

const openFileDialog = async () => {
  const selected = await open({
    directory: tabSelect.value.drop?.isDirectory,
    multiple:
      (tabSelect.value as number | unknown) == mergeCustomFirmwareToolID
        ? true
        : false,
  });

  if (selected !== null) {
    if ((tabSelect.value as number | unknown) == mergeCustomFirmwareToolID) {
      mergeCustomFirmware(selected);
      return;
    }

    if (!Array.isArray(selected)) {
      let fullDirPath = selected.split("\\") as string[];
      let dirName = fullDirPath[fullDirPath.length - 1];
      const re = new RegExp(tabSelect.value.drop?.regex!);
      if (!re.test(dirName)) {
        message.warning("请按要求选择文件夹！");
        return;
      }
      historyPathSave(selected);
      let cmd = (await generateCmd(tabSelect.value.cmd, selected)) as string[];
      runCmd(cmd);
    }
  }
};
onMounted(async () => {
  if (toolListConfig.length > 0) {
    toolsRadio.value = toolListConfig[0].name;
    tabSelect.value = toolListConfig[0];
  }
});
</script>

