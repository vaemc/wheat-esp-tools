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
          <template #title>{{ $t("flash.baudRate") }}</template>
          <a-auto-complete
            style="width: 90%"
            v-model:value="selectedBaud"
            size="small"
            :placeholder="$t('flash.baudRate')"
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
          <template #title>{{ $t("flash.mergeInfo") }}</template>
          <a-select
            style="width: 90%"
            size="small"
            :placeholder="$t('flash.chipType')"
            v-model:value="selectedChipType"
            :options="chipTypeList"
          >
          </a-select
        ></a-tooltip>
      </a-col>
    </a-row>

    <div ref="target">
      <Upload
        :title="$t('flash.dropTitle')"
        :subtitle="$t('flash.dropSubtitle')"
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
          <a @click="flashFirmwareBtn(record)">{{ $t("flash.flash") }}</a> |
          <a @click="removeFirmwareBtn(record)">{{ $t("flash.remove") }}</a>
        </template>
      </template>
    </a-table>
    <a-tooltip>
      <template #title>{{ $t("flash.eraseFlashInfo") }}</template>
      <a-checkbox v-model:checked="eraseChecked">{{
        $t("flash.eraseFlash")
      }}</a-checkbox></a-tooltip
    >
    <a-row :gutter="16">
      <a-col :span="12">
        <a-button type="primary" @click="handle(flash)" block>{{
          $t("flash.flash")
        }}</a-button></a-col
      >
      <a-col :span="12"
        ><a-button type="primary" @click="handle(merge)" block>
          {{ $t("flash.merge") }}
        </a-button></a-col
      >
    </a-row>
  </div>
</template>
<script setup lang="ts">
import { ref, watch } from "vue";
import SPIMode from "@/components/SPIMode.vue";
import SerialPortSelect from "@/components/SerialPortSelect.vue";
import Upload from "@/components/Upload.vue";
import db from "@/db/db";
import { Firmware } from "@/model/model";
import cli, { execute } from "@/utils/cli";
import i18n from "@/locales/i18n";

import {
  getChipTypeList,
  getCurrentDir,
  getFileInfo,
  getIDFArgsConfig,
  getPlatformIOArgsConfig,
  openFileInExplorer,
} from "@/utils/common";
import { message } from "ant-design-vue";
import moment from "moment";
import prettyBytes from "pretty-bytes";
import { storeToRefs } from "pinia";
import { useToolsStore } from "@/stores/Tool";
const store = useToolsStore();
const { firmwareList, selectedChipType } = storeToRefs(store);
const target = ref(null);
const flashCheckOption = ref({ indeterminate: false, selectAll: false });
const selectedMode = ref("keep");
const selectedBaud = ref("1152000");
const eraseChecked = ref(false);
const currentDir = await getCurrentDir();
const columns = ref([
  {
    title: i18n.global.t("flash.flash"),
    dataIndex: "check",
    key: "check",
    width: 35,
  },
  {
    title: i18n.global.t("flash.path"),
    dataIndex: "path",
    key: "path",
    ellipsis: true,
  },
  {
    title: i18n.global.t("flash.address"),
    dataIndex: "address",
    key: "address",
    width: 100,
  },
  {
    title: i18n.global.t("flash.size"),
    dataIndex: "size",
    key: "size",
    width: 80,
  },
  {
    title: i18n.global.t("flash.action"),
    key: "action",
    width: 110,
  },
]);

if (firmwareList.value.length > 0) {
  flashCheckOption.value.selectAll = true;
}

watch(firmwareList, async (newQuestion, oldQuestion) => {
  if (firmwareList.value.length > 0) {
    flashCheckOption.value.selectAll = true;
  }
});
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
    message.warning(i18n.global.t("flash.dialog.selectedChipType"));
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
    message.warning(i18n.global.t("flash.dialog.addFirmware"));
    return;
  }

  if (firmwareList.value.filter((x) => x.check).length == 0) {
    message.warning(i18n.global.t("flash.dialog.selecOneFirmware"));
    return;
  }

  if (firmwareList.value.filter((x) => x.address == "").length > 0) {
    message.warning(i18n.global.t("flash.dialog.inputAddress"));
    return;
  }

  if (firmwareList.value.filter((x) => x.path == "").length > 0) {
    message.warning(i18n.global.t("flash.dialog.inputPath"));
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
