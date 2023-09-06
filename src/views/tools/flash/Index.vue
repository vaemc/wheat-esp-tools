<template>
  <a-modal
    v-model:visible="firmwareModal.visible"
    :title="firmwareModal.title"
    :footer="null"
    width="80%"
  >
    <a-form :label-col="{ span: 4 }">
      <a-form-item label="路径" name="description">
        <a-input-search
          enter-button="选择固件"
          v-model:value="firmware.path"
          @search="openFileDialog(firmware)"
        />
      </a-form-item>

      <a-form-item label="烧录地址" name="address">
        <a-input v-model:value="firmware.address" />
      </a-form-item>
    </a-form>
  </a-modal>

  <a-row
    style="margin-bottom: 5px"
    type="flex"
    justify="space-around"
    align="middle"
  >
    <a-col :span="8">
      <SPIMode v-model="selectedMode" />
    </a-col>
    <a-col :span="8">
      <a-select
        style="width: 120px"
        size="small"
        placeholder="芯片类型"
        v-model:value="selectedChipType"
        :options="chipTypeList"
      >
      </a-select>
    </a-col>
    <a-col :span="8"> </a-col>
  </a-row>

  <div ref="target">
    <Upload
      v-if="destroyDrop"
      title="选择或者拖拽多个bin文件到此"
      subtitle="工具可以自动解析结尾使用下划线加烧录地址的固件,如 'ESP32_0x222.bin'"
      @open="uploadHandle"
      @drop="uploadHandle"
      :isDirectory="false"
      :isMultiple="true"
    />
  </div>
  <a-table
    style="margin: 5px 0"
    :bordered="true"
    :pagination="false"
    :dataSource="firmwareList"
    :columns="columns"
    size="small"
    class="scroll"
  >
    <template #headerCell="{ column }">
      <template v-if="column.key === 'check'">
        <a-checkbox
          v-model:checked="flashCheckOption.selectAll"
          :indeterminate="flashCheckOption.indeterminate"
          @change="flashCheckAllChange"
        ></a-checkbox>
      </template>
    </template>
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'check'">
        <a-checkbox
          v-model:checked="record.check"
          @change="flashCheckSingleChange"
        ></a-checkbox>
      </template>

      <template v-if="column.key === 'action'">
        <a @click="flashFirmwareBtn(record)">烧录</a> |
        <a @click="editFirmwareBtn(record)">编辑</a> |
        <a @click="removeFirmwareBtn(record)">删除</a>
      </template>
    </template>
  </a-table>

  <a-row :gutter="16">
    <a-col :span="12">
      <a-button type="primary" @click="handle(flash)" block
        >烧录</a-button
      ></a-col
    >
    <a-col :span="12"
      ><a-button type="primary" @click="handle(merge)" block>
        合并
      </a-button></a-col
    >
  </a-row>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { writeFlash } from "@/utils/ESPTool";
import { Firmware } from "./model";
import { message } from "ant-design-vue";
import Upload from "@/components/Upload.vue";
import {
  getChipTypeList,
  executedCommand,
  openFileInExplorer,
  getCurrentDir,
  getFlasherArgs2,
  isFile,
  getFileSize,
  collectAllPaths,
} from "@/utils/common";
import SPIMode from "@/components/SPIMode.vue";
import { open } from "@tauri-apps/api/dialog";
import moment from "moment";
import prettyBytes from "pretty-bytes";
import { useElementVisibility } from "@vueuse/core";

const target = ref(null);
const destroyDrop = useElementVisibility(target);

const flashCheckOption = ref({ indeterminate: false, selectAll: false });

const selectedMode = ref("keep");
const firmware = ref({} as Firmware);
const firmwareList = ref([] as Firmware[]);
const firmwareModal = ref({ visible: false, title: "添加固件", isEdit: false });
const currentDir = await getCurrentDir();
const columns = ref([
  {
    title: "烧录",
    dataIndex: "check",
    key: "check",
    width: 35,
  },
  {
    title: "路径",
    dataIndex: "path",
    key: "path",
    ellipsis: true,
  },
  {
    title: "烧录地址",
    dataIndex: "address",
    key: "address",
    width: 80,
  },
  {
    title: "大小",
    dataIndex: "size",
    key: "size",
    width: 80,
  },
  {
    title: "操作",
    key: "action",
    width: 130,
  },
]);

const flash = () => {
  const port = localStorage.getItem("port") as string;
  let cmd = [
    "-p",
    port,
    "-b",
    "1152000",
    "--before=default_reset",
    "--after=hard_reset",
    "write_flash",
    "--flash_mode",
    selectedMode.value,
    ...firmwareList.value
      .filter((x) => x.check)
      .flatMap((x) => [x.address, x.path]),
  ];
  writeFlash(cmd);
};

const merge = async () => {
  if (selectedChipType.value == undefined) {
    message.warning("请选择芯片类型");
    return;
  }

  let filename = `${currentDir}\\firmware\\${
    selectedChipType.value
  }-merge-bin-${moment().format("YYYYMMDDHHmmss")}.bin`;
  let cmd = [
    "--chip",
    selectedChipType.value,
    "merge_bin",
    "-o",
    filename,
    ...firmwareList.value
      .filter((x) => x.check)
      .flatMap((x) => [x.address, x.path]),
  ];
  executedCommand(cmd);
  // await new Promise((r) => setTimeout(r, 2500));
  // openFileInExplorer(filename);
};

const handle = (fun: Function) => {
  if (firmwareList.value.length == 0) {
    message.warning("请添加固件");
    return;
  }

  if (firmwareList.value.filter((x) => x.check).length == 0) {
    message.warning("请最少勾选一个固件");
    return;
  }

  if (firmwareList.value.filter((x) => x.address == "").length > 0) {
    message.warning("烧录地址未填写");
    return;
  }

  if (firmwareList.value.filter((x) => x.path == "").length > 0) {
    message.warning("固件路径未填写");
    return;
  }

  fun();
};

const removeFirmwareBtn = (item: Firmware) => {
  firmwareList.value = firmwareList.value.filter(
    (x: Firmware) => x.path != item.path
  );

  if (firmwareList.value.filter((x) => x.check).length == 0) {
    flashCheckOption.value.indeterminate = false;
    flashCheckOption.value.selectAll = false;
  }

  if (
    firmwareList.value.filter((x) => x.check).length ==
    firmwareList.value.length
  ) {
    flashCheckOption.value.selectAll = true;
    flashCheckOption.value.indeterminate = false;
  }

  if (firmwareList.value.length == 0) {
    flashCheckOption.value.selectAll = false;
    flashCheckOption.value.indeterminate = false;
  }
};

const flashFirmwareBtn = (item: Firmware) => {
  const port = localStorage.getItem("port") as string;
  let cmd = [
    "-p",
    port,
    "-b",
    "1152000",
    "--before=default_reset",
    "--after=hard_reset",
    "write_flash",
    "--flash_mode",
    selectedMode.value,
    item.address,
    item.path,
  ];
  executedCommand(cmd);
};

const editFirmwareBtn = (item: Firmware) => {
  firmwareModal.value.visible = true;
  firmwareModal.value.title = `编辑固件`;
  firmwareModal.value.isEdit = true;
  firmware.value = item;
};

const selectedChipType = ref();

const chipTypeList = ref(
  (await getChipTypeList()).map((item: string) => {
    return { label: item, value: item };
  })
);

const uploadHandle = async (path: string | string[]) => {
  const fillPaths = await Promise.all(
    (path as string[]).map(async (item) => {
      const isFileResult = (await isFile(item)) as boolean;
      const fileSize = (await getFileSize(item)) as number;
      return { path: item, isFile: isFileResult, size: fileSize };
    })
  );

  let flasherArgsJsonFilePath;
  if (fillPaths.length == 1 && !fillPaths[0].isFile) {
    flasherArgsJsonFilePath = (
      (await collectAllPaths(fillPaths[0].path, 0)) as string[]
    ).find((x) => x.substring(x.lastIndexOf("\\") + 1) == "flasher_args.json");
  } else {
    flasherArgsJsonFilePath = fillPaths
      .filter((x) => x.isFile)
      .find(
        (x) =>
          x.path.substring(x.path.lastIndexOf("\\") + 1) == "flasher_args.json"
      )?.path;
  }

  if (
    flasherArgsJsonFilePath !== null &&
    flasherArgsJsonFilePath !== undefined
  ) {
    const flasherArgs = await getFlasherArgs2(flasherArgsJsonFilePath);
    const folderPath = flasherArgsJsonFilePath.substring(
      0,
      flasherArgsJsonFilePath.lastIndexOf("\\")
    );
    await Promise.all(
      Object.keys(flasherArgs.flashFiles).map(async (item) => {
        const fullPath =
          folderPath + "\\" + flasherArgs.flashFiles[item].replace(/\//g, "\\");
        firmwareList.value.push({
          size: prettyBytes((await getFileSize(fullPath)) as number),
          check: true,
          path: fullPath,
          address: item,
        });
      })
    );
    selectedChipType.value = flasherArgs.chip.toUpperCase();
  } else {
    let regex = /0x[\da-f]+/gi;
    fillPaths
      .filter((x) => x.isFile)
      .map((item) => {
        let address = item.path.match(regex);
        firmwareList.value.push({
          size: prettyBytes(item.size),
          check: true,
          path: item.path,
          address: address == null ? "" : address[0],
        });
      });
  }

  if (firmwareList.value.length > 0) {
    flashCheckOption.value.selectAll = true;
  }
};

const flashCheckSingleChange = (e: any) => {
  if (
    firmwareList.value.filter((x) => x.check).length ==
    firmwareList.value.length
  ) {
    flashCheckOption.value.selectAll = true;
    flashCheckOption.value.indeterminate = false;
  } else {
    flashCheckOption.value.indeterminate = true;
  }

  if (firmwareList.value.filter((x) => x.check).length == 0) {
    flashCheckOption.value.indeterminate = false;
    flashCheckOption.value.selectAll = false;
  }
};

const flashCheckAllChange = (e: any) => {
  if (firmwareList.value.length != 0) {
    if (
      firmwareList.value.filter((x) => x.check).length !=
      firmwareList.value.length
    ) {
      flashCheckOption.value.indeterminate = false;
      firmwareList.value.map((item) => {
        return (item.check = true);
      });
      flashCheckOption.value.selectAll = true;
    } else {
      firmwareList.value.map((item) => {
        return (item.check = false);
      });
    }
  } else {
    flashCheckOption.value.selectAll = false;
  }
};

const openFileDialog = async (obj: any) => {
  const selected = await open({
    directory: false,
    multiple: false,
  });
  if (!Array.isArray(selected) && selected !== null) {
    obj.path = selected;
  }
};
</script>
