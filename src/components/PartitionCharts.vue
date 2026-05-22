<template>
  <div v-if="partitions.length" class="partition-charts">
    <div class="chart-box">
      <v-chart class="chart" :option="pieOption" autoresize />
    </div>
    <div class="chart-box chart-box-wide">
      <v-chart class="chart chart-bar" :option="barOption" autoresize />
    </div>
  </div>
  <PlaceholderHint v-else :text="emptyText" />
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
import PlaceholderHint from "@/components/PlaceholderHint.vue";

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
.chart {
  width: 100%;
  height: 220px;
}
.chart-bar {
  height: 260px;
}
</style>
