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
           
            <a @click="flash(item)">{{ $t("firmware.flash") }}</a>
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
import {
  getFileInfo,
  getIDFArgsConfig,
  getPlatformIOArgsConfig,
  openFileInExplorer,
} from "@/utils/common";
import { storeToRefs } from "pinia";
import { useFirmwareListStore } from "@/stores/FirmwareList";
import prettyBytes from "pretty-bytes";
import {  useRouter } from "vue-router";
const router = useRouter();
const store = useFirmwareListStore();
const pathList = ref((await db.getAll("paths")).map((item) => item.path));


async function flash(path: string) {
  const filename = path.replace(/^.*[\\/]/, "");
  const { firmwareList } = storeToRefs(store);
  let config;
  switch (filename) {
    case "flasher_args.json":
      config = await getIDFArgsConfig(path);
      firmwareList.value = config.flashFiles;
      // selectedChipType.value = config.chip;
      db.add("paths", { path: path });
      break;
    case "idedata.json":
      config = await getPlatformIOArgsConfig(path);
      firmwareList.value = config.flashFiles;
      // selectedChipType.value = config.chip;
      db.add("paths", { path: path });
      break;
  }
  firmwareList.value.forEach(async (item) => {
    const fileInfo = await getFileInfo(item.path);
    item.size = prettyBytes(fileInfo.len);
  });

  router.push("/tools/flash");
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
