<template>
  <div v-if="partitions.length" class="partition-charts">
    <div class="chart-box">
      <div class="chart-title">{{ pieTitle }}</div>
      <v-chart class="chart" :option="pieOption" autoresize />
    </div>
    <div class="chart-box chart-box-wide">
      <div class="chart-title">{{ barTitle }}</div>
      <v-chart class="chart chart-bar" :option="barOption" autoresize />
    </div>
  </div>
  <a-empty v-else :description="emptyText" class="charts-empty" />
</template>
<script setup lang="ts">
import { computed } from "vue";
import { use } from "echarts/core";
import { BarChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import VChart from "vue-echarts";
import type { FlashPartition } from "@/utils/partitionBin";
import {
  buildPartitionBarOption,
  buildPartitionPieOption,
} from "@/utils/partitionChart";

use([
  PieChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

const props = defineProps<{
  partitions: FlashPartition[];
  pieTitle: string;
  barTitle: string;
  emptyText: string;
}>();

const pieOption = computed(() => buildPartitionPieOption(props.partitions));
const barOption = computed(() => buildPartitionBarOption(props.partitions));
</script>
<style scoped>
.partition-charts {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}
.chart-box {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
}
.chart-box-wide {
  flex: 1.4;
}
.chart-title {
  margin-bottom: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}
.chart {
  width: 100%;
  height: 220px;
}
.chart-bar {
  height: 260px;
}
.charts-empty {
  margin: 24px 0;
}
</style>
