<template>
  <div style="padding: 10px">
    <SerialPortSelect />
    <a-switch
      v-model:checked="languageSelect"
      @change="languageChange"
      checked-children="中文"
      un-checked-children="English"
      style="margin-right: 5px"
    />
    <a-button
      style="margin-right: 5px"
      v-for="item in list"
      @click="click(item.cmd)"
      >{{ item.name }}</a-button
    >
    <a-button style="margin-right: 5px" @click="readFlash()">{{
      $t("general.readFirmware")
    }}</a-button>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from "vue";
import SerialPortSelect from "@/components/SerialPortSelect.vue";
import cli, { execute } from "@/utils/cli";
import { getCurrentDir, openFileInExplorer } from "@/utils/common";
import moment from "moment";
import i18n from "@/locales/i18n";

const languageSelect = ref(true);
const languageChange = async (value: boolean) => {
  if (value) {
    i18n.global.locale.value = "zh";
    localStorage.setItem("language", "zh");
    location.reload();
  } else {
    i18n.global.locale.value = "en";
    localStorage.setItem("language", "en");
    location.reload();
  }
};
onMounted(() => {
  const language = localStorage.getItem("language");
  console.log(language);

  languageSelect.value = language === "zh" || language == null ? true : false;
});

const currentDir = await getCurrentDir();
const click = async (item: string[]) => {
  const port = localStorage.getItem("port") as string;
  execute(
    "esptool",
    item.map((x) => {
      if (x == "${port}") {
        return port;
      }
      return x;
    }) as string[]
  );

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

const readFlash = async () => {
  const port = localStorage.getItem("port") as string;
  let savePath = `${currentDir}\\firmware\\read-${moment().valueOf()}.bin`;
  execute("esptool", [
    "-p",
    port,
    "-b",
    "460800",
    "read_flash",
    "0",
    "ALL",
    savePath,
  ]);

  const resultPromise = new Promise((resolve, reject) => {
    cli.on("stdout", (data) => {
      if (String(data).includes("Hard resetting via RTS pin...")) {
        openFileInExplorer(savePath);
      }
    });
    cli.on("close", (data) => {
      console.log(data);
      cli.all.clear();
    });
  });
  const result = await resultPromise;
};

const list = ref([
  {
    name: i18n.global.t("general.eraseFlash"),
    cmd: ["-p", "${port}", "erase_flash"],
  },
  {
    name: i18n.global.t("general.flashSize"),
    cmd: ["-p", "${port}", "flash_id"],
  },
]);
</script>
