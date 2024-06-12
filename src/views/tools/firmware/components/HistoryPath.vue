<template>
  <div style="margin: 5px">
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
                <SPIMode v-model="selectedMode" /><br />
                <div style="margin-bottom: 3px"></div>
                <a-tooltip>
                  <template #title>烧录波特率</template>
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
                  <template #title>烧录前是否先擦除固件</template>
                  <a-checkbox
                    v-model:checked="eraseChecked"
                    style="margin-left: 5px"
                    >擦除固件</a-checkbox
                  ></a-tooltip
                >
              </template>
              <a @click="flash(item)">烧录</a>
            </a-popover>

            <a-tooltip>
              <template #title>在资源管理器中打开</template>
              <a
                @click="
                  () => {
                    openFileInExplorer(item);
                  }
                "
                >打开</a
              >
            </a-tooltip>
            <a @click="remove(item)">删除</a> </template
          >{{ item }}</a-list-item
        >
      </template>
    </a-list>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import SPIMode from "@/components/SPIMode.vue";
import db from "@/db/db";
import cli, { execute } from "@/utils/cli";
import {
  getIDFArgsConfig,
  getPlatformIOArgsConfig,
  openFileInExplorer,
} from "@/utils/common";
import { useEventBus } from "@vueuse/core";
import {  Firmware } from "@/model/model";

const selectedBaud = ref("1152000");
const selectedMode = ref("keep");
const pathList = ref((await db.getAll("paths")).map((item) => item.path));
const eraseChecked = ref(false);
const bus = useEventBus<string>("syncSerialPort");
bus.on(listener);

async function listener(event: string) {
  pathList.value = (await db.getAll("paths")).map((item) => item.path);
}

async function flash(path: string) {
  const port = localStorage.getItem("port") as string;
  const filename = path.replace(/^.*[\\/]/, "");
  let config={flashFiles:[] as Firmware[]};
  switch (filename) {
    case "flasher_args.json":
      config = await getIDFArgsConfig(path);
      break;
    case "idedata.json":
      config = await getPlatformIOArgsConfig(path);
      break;
  }
  let cmd = [
    "-p",
    port,
    "-b",
    selectedBaud.value,
    "--before=default_reset",
    "--after=hard_reset",
    "write_flash",
    "--flash_mode",
    selectedMode.value,
    ...config!.flashFiles
      .map((item) => {
        return {
          path: item.path,
          address: item.address,
        };
      })
      .flatMap((x) => [x.address, x.path]),
  ];
  if (eraseChecked.value) {
    cmd.push("--erase-all");
  }
  console.log(cmd);

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
  db.delete("paths", path);
  pathList.value = (await db.getAll("paths")).map((item) => item.path);
};

const onSearch = async (text: string) => {
  if (text == "") {
    pathList.value = (await db.getAll("paths")).map((item) => item.path);
  } else {
    pathList.value = (await db.getAll("paths"))
      .map((item) => item.path)
      .filter((x) => x.toLowerCase().includes(text.toLowerCase()));
  }
};
</script>
