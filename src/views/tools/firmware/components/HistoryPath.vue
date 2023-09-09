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
            <a-popover title="SPI Mode">
              <template #content>
                <SPIMode v-model="selectedMode" />
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
import db from "@/db/db";
import { ref } from "vue";
import { openFileInExplorer, getFlasherArgs2 } from "@/utils/common";
import SPIMode from "@/components/SPIMode.vue";
import cli, { execute } from "@/utils/cli";

const selectedMode = ref("keep");
const pathList = ref((await db.getAll("paths")).map((item) => item.path));

async function flash(path: string) {
  const port = localStorage.getItem("port") as string;

  const flasherArgs = await getFlasherArgs2(path);
  console.log(flasherArgs);
  const folderPath = path.substring(0, path.lastIndexOf("\\"));

  let cmd = [
    "-p",
    port,
    "-b",
    "1152000",
    "--before=default_reset",
    "--after=hard_reset",
    "write_flash",
    "--flash_mode",
    selectedMode.value,
    ...(
      await Promise.all(
        Object.keys(flasherArgs.flashFiles).map(async (item) => {
          const fullPath =
            folderPath +
            "\\" +
            flasherArgs.flashFiles[item].replace(/\//g, "\\");
          return {
            path: fullPath,
            address: item,
          };
        })
      )
    ).flatMap((x) => [x.address, x.path]),
  ];

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
