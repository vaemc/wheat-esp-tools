<template>
  <div style="padding: 10px">
    <a-row :gutter="16">
      <a-col :span="11">
        <a-tabs>
          <a-tab-pane key="1" :tab="$t('partition.offsetCalculation')">
            <div style="margin-bottom: 5px">
              <a-select
                v-model:value="flashSize"
                style="width: 160px"
                :options="flashSizeOptions"
              >
              </a-select>
              <a-button type="primary" style="margin-left: 5px" @click="ok">{{
                $t("partition.calculate")
              }}</a-button>
            </div>
            <a-textarea
              :placeholder="$t('partition.csvContent')"
              v-model:value="beforePartition"
              :rows="15"
              allow-clear
            />
          </a-tab-pane>
          <a-tab-pane key="2" :tab="$t('partition.file')">
            <div ref="target">
              <Upload
                :title="$t('partition.dropTitle')"
                :subtitle="$t('partition.dropSubtitle')"
                :isDirectory="false"
                :isMultiple="false"
                @open="uploadHandle"
                @drop="uploadHandle"
              />
            </div>
          </a-tab-pane>
        </a-tabs>
      </a-col>
      <a-col :span="13">
        <a-tabs>
          <a-tab-pane key="1" :tab="$t('partition.table')">
            <a-table
              :bordered="true"
              :pagination="false"
              size="small"
              class="scroll"
              :dataSource="dataSource"
              :columns="[
                {
                  title: 'Name',
                  dataIndex: '#Name',
                  key: '#Name',
                },
                {
                  title: 'Type',
                  dataIndex: 'Type',
                  key: 'Type',
                },
                {
                  title: 'SubType',
                  dataIndex: 'SubType',
                  key: 'SubType',
                },
                {
                  title: 'Offset',
                  dataIndex: 'Offset',
                  key: 'Offset',
                },
                {
                  title: 'Size',
                  dataIndex: 'Size',
                  key: 'Size',
                },
                {
                  title: 'Flags',
                  dataIndex: 'Flags',
                  key: 'Flags',
                },
              ]"
          /></a-tab-pane>
          <a-tab-pane key="2" :tab="$t('partition.text')"
            ><a-textarea
              v-model:value="afterPartition"
              placeholder=""
              :rows="12"
          /></a-tab-pane>
          <template #rightExtra>
            <a-tag color="success" v-if="partitionSize != ''"
              >{{ i18n.global.t("partition.partitionTableSize") }}:
              {{ partitionSize }}
            </a-tag>
          </template>
        </a-tabs>
      </a-col>
    </a-row>
  </div>
</template>
<script setup lang="ts">
import Upload from "@/components/Upload.vue";
import cli, { execute } from "@/utils/cli";
import { getCurrentDir, writeAllText } from "@/utils/common";
import Papa from "papaparse";
import prettyBytes from "pretty-bytes";
import { ref } from "vue";
import i18n from "@/locales/i18n";

const target = ref(null);

const beforePartition = ref();
const afterPartition = ref();
const partitionSize = ref("");
const dataSource = ref();
const flashSize = ref();
const flashSizeOptions = ref([
  { value: "NONE", label: i18n.global.t("partition.unlimited") },
  { value: "1MB", label: "1MB" },
  { value: "2MB", label: "2MB" },
  { value: "4MB", label: "4MB" },
  { value: "8MB", label: "8MB" },
  { value: "16MB", label: "16MB" },
]);

flashSize.value = flashSizeOptions.value[0].value;

async function partitionTableConvert(
  input: string,
  flashSize: string,
  isBin: boolean,
) {
  let currentDir = await getCurrentDir();
  if (!isBin) {
    await writeAllText(currentDir + "\\partitions\\temp.csv", input);
  }

  execute("gen_esp32part", [
    !isBin ? currentDir + "\\partitions\\temp.csv" : input,
    "1",
    ...(flashSize != "NONE" ? ["--flash-size", flashSize] : []),
    "--out-string",
    "1",
  ]);

  let partitionContent = "#Name,Type,SubType,Offset,Size,Flags\n";

  const resultPromise = new Promise((resolve, reject) => {
    cli.on("stdout", (data) => {
      console.log(data);
      if (String(data).charAt(0) != "#") {
        partitionContent += data + "\n";
      }
    });
    cli.on("close", (data) => {
      cli.all.clear();
      if (partitionContent.split("\n").length != 2) {
        resolve(partitionContent);
      }
    });
  });
  const result = await resultPromise;
  return result;
}

function sumSizesToMB(parts: any, digits = 3): string {
  const totalBytes = parts.reduce(
    (sum: number, p: any) => sum + parseSizeToBytes(p.Size),
    0,
  );
  const mb = totalBytes / (1024 * 1024); // 1 MiB = 1024*1024 bytes
  return `${mb.toFixed(digits)}M`;
}

function parseSizeToBytes(size: string): number {
  const s = size.trim().toUpperCase(); // e.g. "200K", "4M"
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([KM])B?$/);
  if (!m) throw new Error(`Unsupported Size format: ${size}`);

  const value = Number(m[1]);
  const unit = m[2]; // K or M
  if (unit === "K") return value * 1024;
  if (unit === "M") return value * 1024 * 1024;

  throw new Error(`Unsupported unit: ${unit}`);
}

const convert = async (input: string, isBin: boolean) => {
  partitionSize.value = "";
  afterPartition.value = "";
  dataSource.value = [];
  afterPartition.value = await partitionTableConvert(
    input,
    flashSize.value,
    isBin,
  );

  let partitionTable = Papa.parse(afterPartition.value, {
    header: true,
    skipEmptyLines: true,
  }).data.filter((item: any) => Object.keys(item).length == 6);

  dataSource.value = partitionTable;

  partitionSize.value = sumSizesToMB(partitionTable);
};

const uploadHandle = async (path: string | string[]) => {
  convert(path[0], true);
};

const ok = async () => {
  convert(beforePartition.value, false);
};
</script>
