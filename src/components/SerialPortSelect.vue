<template>
  <a-select
    v-model:value="selectedSerialPort"
    @dropdownVisibleChange="focus"
    @focus="focus"
    @change="change"
    style="width: 100%; margin: 0 0 10px"
    :options="serialPortList"
  ></a-select>
</template>
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getSerialPortList } from "@/utils/common";
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
    const localStoragePort = localStorage.getItem("port") as string;
    if (localStoragePort != null) {
      if (list.find((x) => x.value === localStoragePort) != null) {
        selectedSerialPort.value = localStoragePort;
        return;
      }
    }
    selectedSerialPort.value = list[0].value;
    localStorage.setItem("port", list[0].value);
  }
};

const focus = () => {
  refreshList();
};

const change = (data: string) => {
  localStorage.setItem("port", data);
};

onMounted(() => {
  refreshList(true);
});
</script>
