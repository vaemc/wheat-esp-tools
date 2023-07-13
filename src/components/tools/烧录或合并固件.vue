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
  <a-tag color="#108ee9">SPI MODE</a-tag>
  <a-radio-group
    v-model:value="spiMode"
    button-style="solid"
    style="margin-bottom: 5px"
    size="small"
  >
    <a-radio-button value="keep">keep</a-radio-button>
    <a-radio-button value="qio">qio</a-radio-button>
    <a-radio-button value="qout">qout</a-radio-button>
    <a-radio-button value="dio">dio</a-radio-button>
    <a-radio-button value="dout">dout</a-radio-button>
  </a-radio-group>
  <Upload
    title="选择或者拖拽多个bin文件到此"
    subtitle="工具可以自动解析结尾使用下划线加烧录地址的固件,如 'ESP32_0x222.bin'"
    @open="handle"
    @drop="handle"
    :isMultiple="true"
  />

  <a-select
    style="width: 100%; margin: 5px 0"
    placeholder="选择芯片"
    :options="chipTypeList"
  ></a-select>

  <a-table
    :pagination="false"
    :dataSource="firmwareList"
    :columns="columns"
    size="small"
    class="scroll"
  >
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'action'">
        <a @click="editFirmwareBtn(record)">编辑</a> |
        <a @click="removeFirmwareBtn(record)">删除</a>
      </template>
    </template>
  </a-table>

  <div style="display: flex">
    <a-button type="primary" style="flex: 1; margin: 5px" block>合并</a-button>
    <a-button type="primary" style="flex: 1; margin: 5px" block>烧录</a-button>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { message } from "ant-design-vue";
import { Firmware } from "../../utils/model";
import { getChipTypeList } from "../../utils/common";
import { open } from "@tauri-apps/api/dialog";
const spiMode = ref("keep");
const firmware = ref({} as Firmware);
const firmwareList = ref([] as Firmware[]);
const firmwareModal = ref({ visible: false, title: "添加固件", isEdit: false });

const columns = ref([
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

const chipTypeList = ref(
  (await getChipTypeList()).map((item: string) => {
    return {
      value: item,
      label: item,
    };
  })
);

const handle = (path: string[]) => {
  let regex = /0x[\da-f]+/gi;
  firmwareList.value = path.map((item) => {
    console.log(item);
    let address = item.match(regex);
    return {
      path: item,
      address: address == null ? "" : address[0],
    };
  });
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
