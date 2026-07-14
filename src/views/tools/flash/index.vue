<template>
  <div class="flash-page">
    <section class="flash-toolbar">
      <div class="toolbar-options">
        <div class="toolbar-field toolbar-field--spi">
          <SPIMode v-model="selectedMode" />
        </div>
        <div class="toolbar-field">
          <a-tooltip>
            <template #title>{{ $t("flash.baudRate") }}</template>
            <a-auto-complete
              v-model:value="selectedBaud"
              class="toolbar-input"
              :placeholder="$t('flash.baudRate')"
              :options="baudOptions"
            />
          </a-tooltip>
        </div>
        <div class="toolbar-field">
          <a-tooltip>
            <template #title>{{ $t("flash.mergeInfo") }}</template>
            <a-select
              v-model:value="selectedChipType"
              class="toolbar-input"
              :placeholder="$t('flash.chipType')"
              :options="chipTypeList"
            />
          </a-tooltip>
        </div>
      </div>
      <div class="toolbar-actions">
        <a-button @click="eraseFlash">
          {{ $t("flash.eraseAllFlash") }}
        </a-button>
        <a-button @click="readFlash">
          {{ $t("flash.readFlash") }}
        </a-button>
      </div>
    </section>

    <Upload
      :title="$t('flash.dropTitle')"
      :subtitle="$t('flash.dropSubtitle')"
      @open="uploadHandle"
      @drop="uploadHandle"
      :isDirectory="false"
      :isMultiple="true"
    />
    <a-table
      style="margin: 5px 0"
      :bordered="true"
      :pagination="false"
      :dataSource="firmwareList"
      :columns="columns"
      size="small"
      class="scroll"
    >
      <template #headerCell="{ column }">
        <template v-if="column.key === 'check'">
          <a-checkbox
            v-model:checked="flashCheckOption.selectAll"
            :indeterminate="flashCheckOption.indeterminate"
            @change="flashCheckAllChange"
          />
        </template>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'check'">
          <a-checkbox v-model:checked="record.check" />
        </template>
        <template v-if="column.key === 'address'">
          <a-input :bordered="false" v-model:value="record.address" />
        </template>
        <template v-if="column.key === 'action'">
          <span class="flash-row-actions">
            <a @click="flashFirmwareBtn(record)">{{ $t("flash.flashRow") }}</a>
            <span class="flash-row-actions__sep" aria-hidden="true">|</span>
            <a @click="removeFirmwareBtn(record)">{{ $t("flash.remove") }}</a>
          </span>
        </template>
      </template>
    </a-table>
    <a-tooltip>
      <template #title>{{ $t("flash.eraseFlashInfo") }}</template>
      <a-checkbox v-model:checked="eraseChecked">
        {{ $t("flash.eraseFlash") }}
      </a-checkbox>
    </a-tooltip>
    <a-row :gutter="16">
      <a-col :span="12">
        <a-button type="primary" @click="handle(flash)" block>
          {{ $t("flash.flash") }}
        </a-button>
      </a-col>
      <a-col :span="12">
        <a-button type="primary" @click="handle(merge)" block>
          {{ $t("flash.merge") }}
        </a-button>
      </a-col>
    </a-row>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import SPIMode from "@/components/SPIMode.vue";
import Upload from "@/components/Upload.vue";
import { Firmware } from "@/model/model";
import i18n from "@/locales/i18n";
import {
  getChipTypeList,
  getCurrentDir,
  getFileInfo,
  openFileInExplorer,
} from "@/utils/common";
import { runEsptool, runEsptoolWithStdout } from "@/utils/esptoolCli";
import { toBaudSelectOptions } from "@/composables/useFlashOptions";
import { message } from "ant-design-vue";
import moment from "moment";
import prettyBytes from "pretty-bytes";
import { storeToRefs } from "pinia";
import { useToolsStore } from "@/stores/Tool";
import { useHistoryStore } from "@/stores/history";
import { usePortStore } from "@/stores/port";
import { useImportToFlash } from "@/views/tools/firmware/composables/useImportToFlash";
import { useFlashQuickActions } from "./composables/useFlashQuickActions";

const store = useToolsStore();
const historyStore = useHistoryStore();
const { eraseFlash, readFlash } = useFlashQuickActions();
const { applyFlashConfig } = useImportToFlash();

const baudOptions = toBaudSelectOptions();
const { firmwareList, selectedChipType } = storeToRefs(store);
const flashCheckOption = ref({ indeterminate: false, selectAll: false });
const selectedMode = ref("keep");
const selectedBaud = ref("1152000");
const eraseChecked = ref(false);
const currentDir = ref("");

const columns = ref([
  {
    title: i18n.global.t("flash.select"),
    dataIndex: "check",
    key: "check",
    width: 35,
  },
  {
    title: i18n.global.t("flash.path"),
    dataIndex: "path",
    key: "path",
    ellipsis: true,
  },
  {
    title: i18n.global.t("flash.address"),
    dataIndex: "address",
    key: "address",
    width: 110,
  },
  {
    title: i18n.global.t("flash.size"),
    dataIndex: "size",
    key: "size",
    width: 80,
  },
  {
    title: i18n.global.t("flash.action"),
    key: "action",
    width: 150,
  },
]);

if (firmwareList.value.length > 0) {
  flashCheckOption.value.selectAll = true;
}

watch(
  () => firmwareList.value.map((i) => i.check),
  (checks) => {
    const checkedCount = checks.filter(Boolean).length;
    const total = checks.length;

    if (total === 0) {
      flashCheckOption.value.selectAll = false;
      flashCheckOption.value.indeterminate = false;
      return;
    }

    if (checkedCount === total) {
      flashCheckOption.value.selectAll = true;
      flashCheckOption.value.indeterminate = false;
    } else if (checkedCount === 0) {
      flashCheckOption.value.selectAll = false;
      flashCheckOption.value.indeterminate = false;
    } else {
      flashCheckOption.value.selectAll = false;
      flashCheckOption.value.indeterminate = true;
    }
  },
  { immediate: true }
);

function getPort(): string | null {
  const port = usePortStore().selectedPort;
  if (!port) {
    message.warning(i18n.global.t("flash.noPort"));
    return null;
  }
  return port;
}

function buildWriteFlashArgs(extra: string[]): string[] {
  return [
    "-p",
    getPort()!,
    "-b",
    selectedBaud.value,
    "--before=default-reset",
    "--after=hard-reset",
    "write-flash",
    "--flash-mode",
    selectedMode.value,
    ...extra,
  ];
}

const flash = async () => {
  const port = getPort();
  if (!port) {
    return;
  }

  const args = buildWriteFlashArgs(
    firmwareList.value
      .filter((x) => x.check)
      .flatMap((x) => [x.address, x.path])
  );

  if (eraseChecked.value) {
    args.push("--erase-all");
  }

  await runEsptool(args);
};

const merge = async () => {
  if (selectedChipType.value == undefined) {
    message.warning(i18n.global.t("flash.dialog.selectedChipType"));
    return;
  }

  const dir = await ensureCurrentDir();
  const filename = `${dir}\\firmware\\${selectedChipType.value}-merge-bin-${moment().format("YYYYMMDDHHmmss")}.bin`;

  await runEsptoolWithStdout(
    [
      "--chip",
      selectedChipType.value,
      "merge-bin",
      "-o",
      filename,
      ...firmwareList.value
        .filter((x) => x.check)
        .flatMap((x) => [x.address, x.path]),
    ],
    (line) => {
      if (line.includes("ready to flash to offset 0x0")) {
        openFileInExplorer(filename);
      }
    }
  );
};

const handle = (action: () => void | Promise<void>) => {
  if (firmwareList.value.length == 0) {
    message.warning(i18n.global.t("flash.dialog.addFirmware"));
    return;
  }

  if (firmwareList.value.filter((x) => x.check).length == 0) {
    message.warning(i18n.global.t("flash.dialog.selectOneFirmware"));
    return;
  }

  if (firmwareList.value.some((x) => x.address == "")) {
    message.warning(i18n.global.t("flash.dialog.inputAddress"));
    return;
  }

  if (firmwareList.value.some((x) => x.path == "")) {
    message.warning(i18n.global.t("flash.dialog.inputPath"));
    return;
  }

  void action();
};

const removeFirmwareBtn = (item: Firmware) => {
  firmwareList.value = firmwareList.value.filter(
    (x: Firmware) => x.path != item.path
  );

  const checkedCount = firmwareList.value.filter((x) => x.check).length;
  const total = firmwareList.value.length;

  if (checkedCount === 0 || total === 0) {
    flashCheckOption.value.indeterminate = false;
    flashCheckOption.value.selectAll = false;
  } else if (checkedCount === total) {
    flashCheckOption.value.selectAll = true;
    flashCheckOption.value.indeterminate = false;
  }
};

const flashFirmwareBtn = async (item: Firmware) => {
  if (!getPort()) {
    return;
  }

  await runEsptool(buildWriteFlashArgs([item.address, item.path]));
};

const chipTypeList = ref<{ label: string; value: string }[]>([]);

async function ensureCurrentDir() {
  if (!currentDir.value) {
    currentDir.value = await getCurrentDir();
  }
  return currentDir.value;
}

onMounted(async () => {
  await ensureCurrentDir();
  try {
    chipTypeList.value = (await getChipTypeList()).map((item: string) => ({
      label: item,
      value: item,
    }));
  } catch {
    message.error(i18n.global.t("flash.chipListFailed"));
  }
});

const uploadHandle = async (paths: string | string[]) => {
  const pathList = Array.isArray(paths) ? paths : [paths];
  const filename = pathList[0].replace(/^.*[\\/]/, "");

  if (
    pathList.length === 1 &&
    (filename === "flasher_args.json" || filename === "idedata.json")
  ) {
    const ok = await applyFlashConfig(pathList[0]);
    if (ok) {
      historyStore.addPath(pathList[0]);
      flashCheckOption.value.selectAll = true;
    }
    return;
  }

  await Promise.all(
    pathList.map(async (item) => {
      const fileInfo = await getFileInfo(item);
      if (!fileInfo.isFile) {
        return;
      }

      const address = item.match(/0x[\da-f]+/gi);
      firmwareList.value.push({
        size: prettyBytes(fileInfo.len),
        check: true,
        path: item,
        address: address?.[0] ?? "",
      });
    })
  );
};

const flashCheckAllChange = () => {
  if (firmwareList.value.length === 0) {
    flashCheckOption.value.selectAll = false;
    return;
  }

  const allChecked =
    firmwareList.value.filter((x) => x.check).length ===
    firmwareList.value.length;

  firmwareList.value.forEach((item) => {
    item.check = !allChecked;
  });
  flashCheckOption.value.selectAll = !allChecked;
  flashCheckOption.value.indeterminate = false;
};
</script>
<style scoped>
.flash-page {
  padding: 10px;
}

.flash-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 16px;
  margin-bottom: 12px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
}

.toolbar-options {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px 16px;
  flex: 1;
  min-width: 280px;
}

.toolbar-field {
  min-width: 120px;
}

.toolbar-field--spi {
  min-width: 0;
  flex: 0 0 auto;
}

.toolbar-field--spi :deep(.ant-segmented) {
  width: auto;
}

.toolbar-input {
  width: 100%;
  min-width: 120px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.flash-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.flash-row-actions__sep {
  color: rgba(255, 255, 255, 0.25);
  user-select: none;
}
</style>
