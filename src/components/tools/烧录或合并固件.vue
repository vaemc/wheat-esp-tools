<template>
  <Upload
    title="选择或者拖拽多个bin文件到此"
    subtitle="固件结尾使用下划线加烧录地址工具可以自动解析,如 'ESP32_0x222.bin'"
    @openFileDialog="openFileDialog"
    @drop="drop"
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
  },
  {
    title: "操作",
    key: "action",
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
  (await getChipTypeList()).map((item: String) => {
    return {
      value: item,
      label: item,
    };
  })
);

const openFileDialog = (path: String | String[]) => {
  console.log(path);
};

const drop = (path: String | String[]) => {
  console.log(path);
};
</script>
