<template>
  <div style="margin: 5px">
    <a href="#" @click="openFileInExplorer(currentDir + ' \\firmware')"
      >打开文件夹</a
    >
    <a-input-search
      style="margin: 5px 0"
      placeholder=""
      enter-button
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
            <a-popover title="SPI Mode">
              <template #content>
                <SPIMode v-model="selectedMode" />
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
const selectedMode = ref("keep");

const pathList = ref(await getFirmwareList());
const currentDir = await getCurrentDir();

async function flash(path: string) {
  console.log(path);
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
