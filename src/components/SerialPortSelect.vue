<template>
  <a-select
    v-model:value="selectedSerialPort"
    @dropdownVisibleChange="focus"
    @focus="focus"
    @change="change"
    style="width: 100%"
    :options="serialPortList"
  ></a-select>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { portStore } from "./store";
import { getSerialPortList } from "./common";
const selectedSerialPort = ref();
const serialPortList = ref([] as any);

const refreshList = async (showDefaultPort = false) => {
  let list = (await getSerialPortList()).map((item: string) => {
    return {
      value: item,
      label: item,
    };
  });
  serialPortList.value = list;
  if (list.length > 0 && showDefaultPort) {
    selectedSerialPort.value = list[0].value;
    portStore().port = list[0].value;
  }
};

const focus = () => {
  refreshList();
};

const change = (data: string) => {
  portStore().port = data;
};

refreshList(true);
</script>
