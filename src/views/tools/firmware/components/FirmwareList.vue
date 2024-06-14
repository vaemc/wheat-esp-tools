<template>
  <div style="margin: 5px">
    <a
      v-if="pathList.length == 0"
      href="#"
      @click="openDirectoryInExplorer(currentDir + ' \\firmware')"
      >{{ $t("firmware.openTheFolder") }}</a
    >
    <a-input-search
      style="margin: 5px 0"
      placeholder=""
      enter-button
      allow-clear
      @search="onSearch"
    />
    <a-list
      size="small"
      :pagination="{ pageSize: 10, size: 'small' }"
      bordered
      :data-source="pathList"
    >
      <template #renderItem="{ item }">
        <a-list-item
          ><template #actions>
            <a-popover placement="topLeft" :title="$t('firmware.flashOption')">
              <template #content>
                <SPIMode v-model="selectedMode" /><br />
                <div style="margin-bottom: 3px"></div>
                <a-tooltip>
                  <template #title>{{$t('firmware.baudRate')}}</template>
                  <a-segmented
                    v-model:value="selectedBaud"
                    :options="[
                      '115200',
                      '230400',
                      '460800',
                      '921600',
                      '1152000',
                      '1500000',
                    ]"
                /></a-tooltip>
                <a-tooltip>
                  <template #title>{{
                    $t("firmware.eraseFlashInfo")
                  }}</template>
                  <a-checkbox
                    v-model:checked="eraseChecked"
                    style="margin-left: 5px"
                    >{{ $t("firmware.eraseFlash") }}</a-checkbox
                  ></a-tooltip
                >
              </template>
              <a @click="flash(item)">{{ $t("firmware.flash") }}</a>
            </a-popover>
            <a-tooltip>
              <template #title>{{ $t("firmware.openInExplorer") }}</template>
              <a
                @click="
                  () => {
                    openFileInExplorer(item);
                  }
                "
                >{{ $t("firmware.open") }}</a
              >
            </a-tooltip>
            <a @click="remove(item)">{{ $t("firmware.remove") }}</a> </template
          >{{ item.substring(item.lastIndexOf("\\") + 1) }}</a-list-item
        >
      </template>
    </a-list>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import SPIMode from "@/components/SPIMode.vue";
import cli, { execute } from "@/utils/cli";
import {
  getCurrentDir,
  getFirmwareList,
  openFileInExplorer,
  openDirectoryInExplorer,
  removeFile,
} from "@/utils/common";
const selectedBaud = ref("1152000");
const selectedMode = ref("keep");
const eraseChecked = ref(false);
const pathList = ref(await getFirmwareList());
const currentDir = await getCurrentDir();

async function flash(path: string) {
  const port = localStorage.getItem("port") as string;

  let cmd = [
    "-p",
    port,
    "-b",
    selectedBaud.value,
    "write_flash",
    "--flash_mode",
    selectedMode.value,
    "0x0",
    path,
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
}

const remove = async (path: string) => {
  removeFile(path);
  pathList.value = await getFirmwareList();
};

const onSearch = async (text: string) => {
  if (text == "") {
    pathList.value = await getFirmwareList();
  } else {
    pathList.value = (await getFirmwareList()).filter((x) =>
      x
        .toLowerCase()
        .substring(x.toLowerCase().lastIndexOf("\\") + 1)
        .includes(text.toLowerCase())
    );
  }
};
</script>
