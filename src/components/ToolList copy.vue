<template>
  <div>
    <a-modal
      v-model:visible="chipModalVisible"
      :footer="null"
      :maskClosable="false"
      title="选择芯片"
    >
      <a-list size="small" :data-source="chipTypeList">
        <template #renderItem="{ item }">
          <a-list-item>
            <template #actions>
              <a href="#" @click="chipModalClick(item)">选择</a> </template
            >{{ item }}</a-list-item
          >
        </template>
      </a-list>
    </a-modal>

    <a-tabs @change="tabChange">
      <a-tab-pane
        v-for="item in toolListConfig"
        :tab="item.name"
        :key="JSON.stringify(item)"
      >
        <div style="height: 75px" :class="dropBoxClass" @click="openFileDialog">
          <span style="display: block; font-size: 16px; align-self: center">{{
            item.drop?.desc
          }}</span>
          <span
            style="
              display: block;
              font-size: 14px;
              color: gray;
              align-self: center;
            "
            >{{ item.drop?.help }}</span
          >
        </div>
      </a-tab-pane>

      <a-tab-pane key="333" tab="烧录固件到指定地址">
        <a-input
          v-model:value="customFlashAddress"
          addon-before="烧录地址"
          placeholder=""
          style="margin-bottom: 5px"
        />
        <!-- <a-auto-complete
          :options="[{ value: 'text 1' }, { value: 'text 2' }]"
          style="margin-bottom: 5px; width: 100%"
          placeholder="请输入烧录地址"
        >
        </a-auto-complete> -->

        <div style="height: 75px" :class="dropBoxClass" @click="openFileDialog">
          <span style="display: block; font-size: 16px; align-self: center"
            >选择或者拖拽bin文件到此</span
          >
          <span
            style="
              display: block;
              font-size: 14px;
              color: gray;
              align-self: center;
            "
            >请先填写烧录地址后再选择或者拖拽bin文件
          </span>
        </div>
      </a-tab-pane>

      <a-tab-pane :key="mergeCustomFirmwareToolID" tab="合并自定义固件">
        <div style="height: 75px" :class="dropBoxClass" @click="openFileDialog">
          <span style="display: block; font-size: 16px; align-self: center"
            >选择或者拖拽多个bin文件到此</span
          >
          <span
            style="
              display: block;
              font-size: 14px;
              color: gray;
              align-self: center;
            "
            >固件名称需要以下划线加烧录地址结尾如 "ESP32_AT_0x222.bin"
          </span>
        </div>
      </a-tab-pane>
      <a-tab-pane :key="moreToolID" tab="更多功能">
        <SimpleToolList style="flex: 1; margin-left: 5px" />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>
<script setup lang="ts">
import SimpleToolList from "./SimpleToolList.vue";
import { ref, onMounted, h } from "vue";
import { message } from "ant-design-vue";
import { runCmd, generateCmd } from "../utils/esptool";
import { listen } from "@tauri-apps/api/event";
import { getToolListConfig, getCurrentDir } from "../utils/common";
import { open } from "@tauri-apps/api/dialog";
import { historyPathStore } from "../utils/store";
import { HistoryPath, ToolConfig } from "../utils/model";
import {
  chipTypeList as ct,
  mergeCustomFirmwareToolID,
  moreToolID,
} from "../utils/tools-config";
import emitter from "../utils/bus";
import moment from "moment";

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

listen("tauri://file-drop", async (event: any) => {
  dropBoxClass.value = "dropBox";
  let path = event.payload[0];
  console.log(path);

  if (
    event.payload.length >= 1 &&
    (tabSelect.value as number | unknown) == mergeCustomFirmwareToolID
  ) {
    mergeCustomFirmware(event.payload);
    return;
  }

  if ((tabSelect.value as number | unknown) == "333") {
    if (customFlashAddress.value == "") {
      message.warning("请输入烧录地址！");
      return;
    }

    let cmd = [
      "-p",
      "${port}",
      "-b",
      "921600",
      "--after",
      "hard_reset",
      "write_flash",
      "--flash_mode",
      "dio",
      "--flash_size",
      "detect",
      "--flash_freq",
      "40m",
      customFlashAddress.value,
      path,
    ];
    console.log(cmd);
    cmd = (await generateCmd(cmd, path)) as string[];
    return;
  }

  let filename = path.replace(/^.*[\\\/]/, "");
  const re = new RegExp(tabSelect.value.drop?.regex!);
  if (!re.test(filename)) {
    message.warning("请按要求选择文件！");
    return;
  }
  historyPathSave(path);
  let cmd = (await generateCmd(tabSelect.value.cmd, path)) as string[];
  runCmd(cmd);
});

listen("tauri://file-drop-hover", (event: any) => {
  // let path = event.payload[0];
  // let filename = path.replace(/^.*[\\\/]/, "");
  // const re = new RegExp(tabSelect.value.drop?.regex!);
  // if (re.test(filename)) {
  //   dropBoxClass.value = "dropBoxHover";
  // }
  dropBoxClass.value = "dropBoxHover";
});

listen("tauri://file-drop-cancelled", () => {
  dropBoxClass.value = "dropBox";
});

const tabChange = (item: any) => {
  tabSelect.value = JSON.parse(item);
};

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

<style>
.dropBox {
  width: 100%;
  height: 120px;
  border: 1px dashed #434343;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: all ease 0.5s;
  /* transition: 0.5s ease; */
}

.dropBox:hover {
  width: 100%;
  height: 120px;
  border: 1px dashed #177ddc;
  cursor: pointer;
  transition: all ease 1s;
}

.dropBoxHover {
  width: 100%;
  height: 120px;
  border: 1px dashed #177ddc;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: all ease 1s;
}
</style>
