<template>
  <a-select
    v-model:value="selectedSerialPort"
    @dropdownVisibleChange="focus"
    @focus="focus"
    @change="change"
    style="width: 100%; margin: 0 0 10px"
    :options="serialPortList"
  ></a-select>
  <a-descriptions size="small" :column="4"
    ><a-descriptions-item label="Chip Type">{{
      deviceInfo.chipType
    }}</a-descriptions-item>
    <a-descriptions-item label="MAC"
      ><p v-copy>{{ deviceInfo.mac }}</p></a-descriptions-item
    >
    <a-descriptions-item label="Flash Size">{{
      deviceInfo.flashSize
    }}</a-descriptions-item>
    <a-descriptions-item label="PSRAM">{{
      deviceInfo.psram
    }}</a-descriptions-item>
  </a-descriptions>
</template>
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getSerialPortList } from "@/utils/common";
import cli, { execute } from "@/utils/cli";
interface DeviceInfo {
  chipType: string;
  mac: string;
  flashSize: string;
  psram: string;
}
const selectedSerialPort = ref();
const serialPortList = ref([] as any);
const deviceInfo = ref<DeviceInfo>({
  chipType: "",
  mac: "",
  flashSize: "",
  psram: "",
});

const handleSingleLogLine = (logLine: string) => {
  if (!logLine || typeof logLine !== "string") return;

  const chipTypeReg = /Detecting chip type\.\.\.\s*([\w-]+)/;
  const macReg = /MAC:\s*([0-9A-Fa-f:]{17})/;
  const flashReg = /Detected flash size:\s*([\d]+MB)/;
  const psramReg = /PSRAM\s*([\d]+MB)/;

  const macMatch = macReg.exec(logLine);
  if (macMatch) {
    deviceInfo.value.mac = macMatch[1];
  }

  const chipModelMatch = chipTypeReg.exec(logLine);
  if (chipModelMatch) {
    deviceInfo.value.chipType = chipModelMatch[1];
  }

  const flashMatch = flashReg.exec(logLine);
  if (flashMatch) {
    deviceInfo.value.flashSize = flashMatch[1];
  }

  const psramMatch = psramReg.exec(logLine);
  if (psramMatch) {
    deviceInfo.value.psram = psramMatch[1];
  }
};

const getDeviceInfo = (port: string) => {
  execute("esptool", ["-p", port, "-b", "115200", "flash_id"]);
  const resultPromise = new Promise((resolve, reject) => {
    cli.on("stdout", (data: any) => {
      console.log(data);
      handleSingleLogLine(data);
    });
    cli.on("close", (data) => {
      console.log(data);
      cli.all.clear();
    });
  });
};

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
        getDeviceInfo(selectedSerialPort.value);
        return;
      }
    }
    selectedSerialPort.value = list[0].value;
    localStorage.setItem("port", list[0].value);
    getDeviceInfo(list[0].value);
  }
};

const focus = () => {
  refreshList();
};

const change = (data: string) => {
  localStorage.setItem("port", data);

  deviceInfo.value = {
    chipType: "",
    mac: "",
    flashSize: "",
    psram: "",
  };
  getDeviceInfo(data);
};

onMounted(() => {
  refreshList(true);
});
</script>
