<template>
  <div style="padding: 10px">
    <a-row :gutter="16">
      <a-col :span="11">
        <a-tabs>
          <a-tab-pane key="1" tab="偏移地址计算">
            <div style="margin-bottom: 5px">
              <a-select
                v-model:value="flashSize"
                style="width: 160px"
                :options="flashSizeOptions"
              >
              </a-select>
              <a-button type="primary" style="margin-left: 5px" @click="ok"
                >计算</a-button
              >
            </div>
            <a-textarea
              placeholder="CSV内容"
              v-model:value="beforePartition"
              :rows="15"
              allow-clear
            />
          </a-tab-pane>
          <a-tab-pane key="2" tab="文件">
            <div ref="target">
              <Upload
                v-if="destroyDrop"
                title="选择或者拖拽文件到此"
                subtitle="分区表csv或分区表bin文件"
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
          <a-tab-pane key="1" tab="表格">
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
          <a-tab-pane key="2" tab="文本"
            ><a-textarea
              v-model:value="afterPartition"
              placeholder=""
              :rows="12"
          /></a-tab-pane>
          <template #rightExtra>
            <a-tag color="success" v-if="partitionSize.kb != ''"
              >分区表大小: {{ partitionSize.kb }} {{ partitionSize.byte }} B
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
import { useElementVisibility } from "@vueuse/core";
import Papa from "papaparse";
import prettyBytes from "pretty-bytes";
import { ref } from "vue";
const target = ref(null);
const destroyDrop = useElementVisibility(target);

const beforePartition = ref();
const afterPartition = ref();
const partitionSize = ref({ kb: "", byte: "" });
const dataSource = ref();
const flashSize = ref();
const flashSizeOptions = ref([
  { value: "NONE", label: "不限制FLASH大小" },
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
  isBin: boolean
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

const convert = async (input: string, isBin: boolean) => {
  partitionSize.value = { kb: "", byte: "" };
  afterPartition.value = "";
  dataSource.value = [];
  afterPartition.value = await partitionTableConvert(
    input,
    flashSize.value,
    isBin
  );

  let partitionTable = Papa.parse(afterPartition.value, {
    header: true,
    skipEmptyLines: true,
  }).data.filter((item: any) => Object.keys(item).length == 6);

  dataSource.value = partitionTable;

  let last = partitionTable.at(-1) as any;

  partitionSize.value = {
    kb: prettyBytes(
      parseInt(last.Offset) + parseInt(last.Size.slice(0, -1)) * 1024
    ),
    byte: String(
      parseInt(last.Offset) + parseInt(last.Size.slice(0, -1)) * 1024
    ),
  };
};

const uploadHandle = async (path: string | string[]) => {
  convert(path[0], true);
};

const ok = async () => {
  convert(beforePartition.value, false);
};
</script>
