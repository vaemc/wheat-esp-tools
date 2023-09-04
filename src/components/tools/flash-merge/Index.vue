<template>
  <a-modal v-model:visible="firmwareModal.visible" :title="firmwareModal.title" :footer="null" width="80%">
    <a-form :label-col="{ span: 4 }">
      <a-form-item label="路径" name="description">
        <a-input-search enter-button="选择固件" v-model:value="firmware.path" @search="openFileDialog(firmware)" />
      </a-form-item>

      <a-form-item label="烧录地址" name="address">
        <a-input v-model:value="firmware.address" />
      </a-form-item>
    </a-form>
  </a-modal>

  <a-row>
    <a-col :span="12">
      <FlashOption v-model="selectedFlashOption" @change="flashOptionChange" />
    </a-col>
    <a-col :span="12">
      <SPIMode v-model="selectedMode" />
    </a-col>
  </a-row>

  <Upload :title="selectedFlashOptionConfig.title" :subtitle="selectedFlashOptionConfig.subtitle" @open="uploadHandle"
    @drop="uploadHandle" :isDirectory="isBuildDir" :isMultiple="!isBuildDir" />

  <a-table style="margin: 5px 0" :bordered="true" :pagination="false" :dataSource="firmwareList" :columns="columns"
    size="small" class="scroll">
    <template #headerCell="{ column }">
      <template v-if="column.key === 'check'">
        <a-checkbox v-model:checked="selectAllItems" :indeterminate="indeterminate"
          @change="selectAllChange"></a-checkbox>
      </template>
    </template>
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'check'">
        <a-checkbox v-model:checked="record.check" @change="selectSingleChange"></a-checkbox>
      </template>
      <template v-if="column.key === 'action'">
        <a @click="editFirmwareBtn(record)">编辑</a> |
        <a @click="removeFirmwareBtn(record)">删除</a>
      </template>
    </template>
  </a-table>

  <div style="display: flex">
    <a-button type="primary" @click="handle(flash)" style="flex: 1; margin: 5px" block>烧录</a-button>
    <a-dropdown>
      <template #overlay>
        <a-menu>
          <a-menu-item @click="handle(merge, item)" :key="item" v-for="item in chipTypeList">{{ item }}</a-menu-item>
        </a-menu>
      </template>
      <a-button type="primary" style="flex: 1; margin: 5px" block>
        合并
      </a-button>
    </a-dropdown>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { Firmware } from "./model";
import { message } from "ant-design-vue";
import Upload from "../Upload.vue"
import {
  getChipTypeList,
  selectedPort,
  executedCommand,
  openFileInExplorer,
  getCurrentDir, getFlasherArgs2
} from "../../common";
import { config } from "./"
import { Option } from "./model";
import FlashOption from "./components/FlashOption.vue";
import SPIMode from "../SPIMode.vue";
import { open } from "@tauri-apps/api/dialog";
import moment from "moment";


const isBuildDir = ref();
const indeterminate = ref();
const selectAllItems = ref();
const selectedMode = ref("keep");
const selectedFlashOption = ref("custom");
const selectedFlashOptionConfig = ref(config[0]);
const firmware = ref({} as Firmware);
const firmwareList = ref([] as Firmware[]);
const firmwareModal = ref({ visible: false, title: "添加固件", isEdit: false });
const currentDir = await getCurrentDir();
const columns = ref([
  {
    title: "选择",
    dataIndex: "check",
    key: "check",
    width: 50,
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
    width: 100,
  },
  {
    title: "操作",
    key: "action",
    width: 100,
  },
]);

const flash = () => {
  let cmd = [
    "-p",
    selectedPort(),
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
  executedCommand(cmd);
};

const merge = async (item: string) => {
  let filename = `${currentDir}\\firmware\\${item}-merge-bin-${moment().format(
    "YYYYMMDDHHmmss"
  )}.bin`;
  let cmd = [
    "--chip",
    item,
    "merge_bin",
    "-o",
    filename,
    ...firmwareList.value
      .filter((x) => x.check)
      .flatMap((x) => [x.address, x.path]),
  ];
  executedCommand(cmd);
  await new Promise((r) => setTimeout(r, 2500));
  openFileInExplorer(filename);
};

const handle = (fun: Function, data: string = "") => {
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

  fun(data);
};

const removeFirmwareBtn = (item: Firmware) => {
  firmwareList.value = firmwareList.value.filter(
    (x: Firmware) => x.path != item.path
  );
  message.success("删除成功！");
};

const editFirmwareBtn = (item: Firmware) => {
  firmwareModal.value.visible = true;
  firmwareModal.value.title = `编辑固件`;
  firmwareModal.value.isEdit = true;
  firmware.value = item;
};

const chipTypeList = ref(await getChipTypeList());

const uploadHandle = async (path: string | string[]) => {
  if (selectedFlashOptionConfig.value.type == "custom") {
    let regex = /0x[\da-f]+/gi;
    (path as string[]).map((item) => {
      console.log(item);
      let address = item.match(regex);
      firmwareList.value.push({
        check: true,
        path: item,
        address: address == null ? "" : address[0],
      });
    });

  }

  if (selectedFlashOptionConfig.value.type == "flasher_args.json") {
    const flasherArgs = await getFlasherArgs2(path[0]);
    const folderPath = path[0].substring(0, path[0].lastIndexOf('\\'));
    Object.keys(flasherArgs.flashFiles).map(item => {
      firmwareList.value.push({
        check: true,
        path: folderPath + "\\" + flasherArgs.flashFiles[item].replace(/\//g, '\\'),
        address: item,
      });
    })
  }

  selectAllItems.value = true;
};

const selectSingleChange = (e: any) => {

  if (firmwareList.value.filter(x => x.check).length == firmwareList.value.length) {
    selectAllItems.value = true;
    indeterminate.value = false
  } else {
    indeterminate.value = true
  }
}

const selectAllChange = (e: any) => {
  if (firmwareList.value.length != 0) {
    if (firmwareList.value.filter(x => x.check).length != firmwareList.value.length) {
      indeterminate.value = false
      firmwareList.value.map(item => {
        return item.check = true;
      })
      selectAllItems.value = true;
    } else {
      firmwareList.value.map(item => {
        return item.check = false;
      })
    }
  } else {
    selectAllItems.value = false;
  }


}

const flashOptionChange = (item: Option) => {
  selectedFlashOptionConfig.value = item
}

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
