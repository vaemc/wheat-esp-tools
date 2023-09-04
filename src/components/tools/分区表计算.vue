<template>
  <div>
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

    <a-row :gutter="16">
      <a-col :span="11">
        <a-textarea
          placeholder="CSV内容"
          v-model:value="beforePartition"
          max
          :rows="18"
      /></a-col>
      <a-col :span="13">
        <a-tag color="success" v-if="partitionSize != ''"
          >分区表大小: {{ partitionSize.kb }} {{ partitionSize.byte }} B
        </a-tag>
        <a-tabs v-model:activeKey="activeKey">
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
          <a-tab-pane key="2" tab="文本" force-render
            ><a-textarea
              v-model:value="afterPartition"
              placeholder=""
              :rows="12"
          /></a-tab-pane>
        </a-tabs>
      </a-col>
    </a-row>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { partitionTableConvert } from "../../utils/common";
import Papa from "papaparse";
import prettyBytes from "pretty-bytes";

const activeKey = ref("1");

const beforePartition = ref();
const afterPartition = ref();
const partitionSize = ref();
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

const ok = async () => {
  partitionSize.value = "";
  afterPartition.value = "";
  dataSource.value = [];
  afterPartition.value = await partitionTableConvert(
    beforePartition.value,
    flashSize.value
  );

  let partition = Papa.parse(afterPartition.value, {
    header: true,
    skipEmptyLines: true,
  }).data.filter((item: any) => Object.keys(item).length == 6);

  dataSource.value = partition;

  let last = partition.at(-1) as any;

  partitionSize.value = {
    kb: prettyBytes(
      parseInt(last.Offset) + parseInt(last.Size.slice(0, -1)) * 1024
    ),
    byte: parseInt(last.Offset) + parseInt(last.Size.slice(0, -1)) * 1024,
  };
};
</script>
