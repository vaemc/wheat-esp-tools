<template>
  <div
    v-if="partitions.length"
    class="partition-charts"
    :class="{ 'is-compact': compact }"
  >
    <div class="chart-box">
      <v-chart class="chart" :option="pieOption" autoresize />
    </div>
    <div class="chart-box chart-box-wide">
      <v-chart class="chart chart-bar" :option="barOption" autoresize />
    </div>
  </div>
  <div v-else class="charts-empty">
    <PlaceholderHint :text="emptyText" />
  </div>
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
  compact?: boolean;
}>();

const pieOption = computed(() => buildPartitionPieOption(props.partitions));
const barOption = computed(() => buildPartitionBarOption(props.partitions));
</script>
<style scoped>
.partition-charts {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

.charts-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  height: 100%;
}

.chart-box {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
}

.chart-box-wide {
  flex: 1.35;
}

.chart {
  width: 100%;
  height: 100%;
  min-height: 160px;
}

.partition-charts:not(.is-compact) .chart {
  min-height: 220px;
}

.partition-charts:not(.is-compact) .chart-bar {
  min-height: 260px;
}

@media (min-width: 1100px) {
  .partition-charts.is-compact {
    flex-direction: column;
  }
}
</style>
