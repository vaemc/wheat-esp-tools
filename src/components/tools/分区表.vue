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
  </a-card>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { getCurrentDir, getFulPartitionTable } from "../../utils/common";
const originalCSV = ref();
const newCSV = ref();
const flashSize = ["1M", "2M", "4M", "8M", "16M"];
const flashSizeOptions = ref(
  flashSize.map((item) => {
    return { value: item, label: item };
  })
);
console.log(`${await getCurrentDir()}\\partitions\\temp.csv`);

const ok = async () => {
  console.log(originalCSV.value);
  newCSV.value = await getFulPartitionTable(originalCSV.value);
};
</script>
