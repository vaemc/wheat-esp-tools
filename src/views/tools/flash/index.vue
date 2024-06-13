<template>
  <div style="padding: 10px">
    <SerialPortSelect />
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
        <a-tooltip>
          <template #title>烧录波特率</template>
          <a-auto-complete
            style="width: 90%"
            v-model:value="selectedBaud"
            size="small"
            placeholder="烧录波特率"
            :options="[
              { value: '115200' },
              { value: '230400' },
              { value: '460800' },
              { value: '921600' },
              { value: '1152000' },
              { value: '1500000' },
            ]"
        /></a-tooltip>
      </a-col>
      <a-col :span="8">
        <a-tooltip>
          <template #title>仅合并固件时需要选择</template>
          <a-select
            style="width: 90%"
            size="small"
            placeholder="芯片类型"
            v-model:value="selectedChipType"
            :options="chipTypeList"
          >
          </a-select
        ></a-tooltip>
      </a-col>
    </a-row>

    <div ref="target">
      <Upload
        v-if="destroyDrop"
        title="选择或者拖拽多个bin文件到此"
        subtitle="工具可以自动解析结尾使用下划线加地址的固件,如 'ESP32_0x222.bin'"
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
        <template v-if="column.key === 'address'">
          <a-input :bordered="false" v-model:value="record.address" />
        </template>
        <template v-if="column.key === 'action'">
          <a @click="flashFirmwareBtn(record)">烧录</a> |
          <a @click="removeFirmwareBtn(record)">删除</a>
        </template>
      </template>
    </a-table>
    <a-tooltip>
      <template #title>烧录前是否先擦除固件</template>
      <a-checkbox v-model:checked="eraseChecked"
        >擦除固件</a-checkbox
      ></a-tooltip
    >
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
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import SPIMode from "@/components/SPIMode.vue";
import SerialPortSelect from "@/components/SerialPortSelect.vue";
import Upload from "@/components/Upload.vue";
import db from "@/db/db";
import { Firmware } from "@/model/model";
import cli, { execute } from "@/utils/cli";
import {
  getChipTypeList,
  getCurrentDir,
  getFileInfo,
  getIDFArgsConfig,
  getPlatformIOArgsConfig,
  openFileInExplorer,
} from "@/utils/common";
import { useElementVisibility } from "@vueuse/core";
import { message } from "ant-design-vue";
import moment from "moment";
import prettyBytes from "pretty-bytes";
const target = ref(null);
const destroyDrop = useElementVisibility(target);

const flashCheckOption = ref({ indeterminate: false, selectAll: false });

const selectedChipType = ref();
const selectedMode = ref("keep");
const selectedBaud = ref("1152000");

const eraseChecked = ref(false);
const firmwareList = ref([] as Firmware[]);
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
    title: "固件地址",
    dataIndex: "address",
    key: "address",
    width: 100,
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
    width: 90,
  },
]);

const flash = async () => {
  const port = localStorage.getItem("port") as string;
  let cmd = [
    "-p",
    port,
    "-b",
    selectedBaud.value,
    "--before=default_reset",
    "--after=hard_reset",
    "write_flash",
    "--flash_mode",
    selectedMode.value,
    ...firmwareList.value
      .filter((x) => x.check)
      .flatMap((x) => [x.address, x.path]),
  ];
  if (eraseChecked.value) {
    cmd.push("--erase-all");
  }
  execute("esptool", cmd);

  const resultPromise = new Promise((resolve, reject) => {
    cli.on("stdout", (data) => {
      console.log(data);
    });
    cli.on("close", (data) => {
      console.log(data);
      cli.all.clear();
    });
  });
  const result = await resultPromise;
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
  execute("esptool", cmd);

  const resultPromise = new Promise((resolve, reject) => {
    cli.on("stdout", (data) => {
      if (String(data).includes("ready to flash to offset 0x0")) {
        openFileInExplorer(filename);
      }
    });
    cli.on("close", (data) => {
      console.log(data);
      cli.all.clear();
    });
  });
  const result = await resultPromise;
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
    message.warning("固件地址未填写");
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

const flashFirmwareBtn = async (item: Firmware) => {
  const port = localStorage.getItem("port") as string;
  let cmd = [
    "-p",
    port,
    "-b",
    selectedBaud.value,
    "--before=default_reset",
    "--after=hard_reset",
    "write_flash",
    "--flash_mode",
    selectedMode.value,
    item.address,
    item.path,
  ];
  execute("esptool", cmd);
  const resultPromise = new Promise((resolve, reject) => {
    cli.on("stdout", (data) => {
      console.log(data);
    });
    cli.on("close", (data) => {
      console.log(data);
      cli.all.clear();
    });
  });
  const result = await resultPromise;
};

const chipTypeList = ref(
  (await getChipTypeList()).map((item: string) => {
    return { label: item, value: item };
  })
);

const uploadHandle = async (paths: string | string[]) => {
  const filename = paths[0].replace(/^.*[\\/]/, "");
  if (
    (paths.length == 1 && filename === "flasher_args.json") ||
    filename === "idedata.json"
  ) {
    let config;
    switch (filename) {
      case "flasher_args.json":
        config = await getIDFArgsConfig(paths[0]);
        firmwareList.value = config.flashFiles;
        selectedChipType.value = config.chip;
        db.add("paths", { path: paths[0] });
        break;
      case "idedata.json":
        config = await getPlatformIOArgsConfig(paths[0]);
        firmwareList.value = config.flashFiles;
        selectedChipType.value = config.chip;
        db.add("paths", { path: paths[0] });
        break;
    }
    firmwareList.value.forEach(async (item) => {
      const fileInfo = await getFileInfo(item.path);
      item.size = prettyBytes(fileInfo.len);
    });
  } else {
    await Promise.all(
      (paths as string[]).map(async (item) => {
        const fileInfo = await getFileInfo(item);
        if (fileInfo.isFile) {
          let regex = /0x[\da-f]+/gi;
          let address = item.match(regex);
          firmwareList.value.push({
            size: prettyBytes(fileInfo.len),
            check: true,
            path: item,
            address: address == null ? "" : address[0],
          });
        }
      })
    );
  }
  if (firmwareList.value.length > 0) {
    flashCheckOption.value.selectAll = true;
  }
};

const flashCheckSingleChange = () => {
  if (
    firmwareList.value.filter((x) => x.check).length ==
    firmwareList.value.length
  ) {
    flashCheckOption.value.selectAll = true;
    flashCheckOption.value.indeterminate = false;
  } else {
    flashCheckOption.value.selectAll = false;
    flashCheckOption.value.indeterminate = true;
  }

  if (firmwareList.value.filter((x) => x.check).length == 0) {
    flashCheckOption.value.indeterminate = false;
    flashCheckOption.value.selectAll = false;
  }
};

const flashCheckAllChange = () => {
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
</script>
