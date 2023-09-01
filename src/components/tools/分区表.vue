<template>
  <a-card size="small" title="偏移地址计算">
    <div style="margin-bottom: 5px">
      <a-select
        style="width: 160px"
        placeholder="不限制FLASH大小"
        :options="flashSizeOptions"
      >
      </a-select>
      <a-button type="primary" style="margin-left: 5px" @click="ok"
        >计算</a-button
      >
    </div>

    <a-row :gutter="16">
      <a-col :span="12"
        ><a-textarea
          placeholder="分区表CSV内容"
          v-model:value="originalCSV"
          max
          :rows="12"
      /></a-col>
      <a-col :span="12"
        ><a-textarea v-model:value="newCSV" placeholder="计算结果" :rows="12"
      /></a-col>
    </a-row>

    <hot-table :settings="hotSettings" ref="hotTableComponent"></hot-table>
  </a-card>
</template>
<script setup lang="ts">
import { reactive, onMounted, ref } from "vue";
import { getCurrentDir, getFulPartitionTable } from "../../utils/common";
import { HotTable } from "@handsontable/vue3";
import { registerAllModules } from "handsontable/registry";
import "handsontable/dist/handsontable.full.css";
import Papa from "papaparse";
import "handsontable/languages/zh-CN"; //中文包
registerAllModules();

const hotSettings = ref({
  data: [],
  height: "auto",
  colWidths: 120,
  colHeaders: false,
  rowHeaders: false,
  contextMenu: false,
  language: "zh-CN",
  licenseKey: "non-commercial-and-evaluation",
});

const hotTableComponent = ref();
const originalCSV = ref();
const newCSV = ref();
const flashSize = ["1M", "2M", "4M", "8M", "16M"];
const flashSizeOptions = ref(
  flashSize.map((item) => {
    return { value: item, label: item };
  })
);

const ok = async () => {
  newCSV.value = await getFulPartitionTable(originalCSV.value);
  hotTableComponent.value?.hotInstance.updateData(
    Papa.parse(newCSV.value, { header: false }).data
  );
};
</script>
