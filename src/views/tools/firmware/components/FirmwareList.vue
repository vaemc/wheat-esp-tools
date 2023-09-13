<template>
  <div style="margin: 5px">
    <a href="#" @click="openFileInExplorer(currentDir + ' \\firmware')"
      >打开文件夹</a
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
            <a-popover placement="topLeft" title="烧录选项">
              <template #content>
                <SPIMode v-model="selectedMode" /><a-checkbox
                  v-model:checked="eraseChecked" style="margin-left: 5px;"
                  >擦除固件</a-checkbox
                >
              </template>
              <a @click="flash(item)">烧录</a>
            </a-popover>

            <a @click="remove(item)">删除</a> </template
          >{{ item.substring(item.lastIndexOf("\\") + 1) }}</a-list-item
        >
      </template>
    </a-list>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import List from "./List.vue";
import {
  getFirmwareList,
  getCurrentDir,
  openFileInExplorer,
  removeFile,
} from "@/utils/common";
import SPIMode from "@/components/SPIMode.vue";
import cli, { execute } from "@/utils/cli";

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
    "1152000",
    "write_flash",
    "--flash_mode",
    selectedMode.value,
    "0x0",
    path,
  ];
  if(eraseChecked.value){
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
      x.toLowerCase().includes(text.toLowerCase())
    );
  }
};
</script>
