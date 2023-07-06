<template>
  <a-select
    v-model:value="selectSerialPort"
    @dropdownVisibleChange="serialPortListSelectFocus"
    @focus="serialPortListSelectFocus"
    @change="serialPortListSelectChange"
    style="width: 100%"
    :options="serialPortList"
  ></a-select>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { portStore } from "../utils/store";
import { getSerialPortList } from "../utils/common";

const selectSerialPort = ref();
const serialPortList = ref([] as any);
const refreshSerialPortList = async (showDefaultPort = false) => {
  let list = (await getSerialPortList()).map((item: string) => {
    return {
      value: item,
      label: item,
    };
  });

  serialPortList.value = list;
  if (list.length > 0 && showDefaultPort) {
    selectSerialPort.value = list[0].value;
    portStore().port = list[0].value;
  }
};
const serialPortListSelectFocus = () => {
  refreshSerialPortList();
};
const serialPortListSelectChange = (data: string) => {
  portStore().port = data;
};
refreshSerialPortList(true);
</script>
