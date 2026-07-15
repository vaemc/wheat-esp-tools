<template>
  <div
    v-if="partitions.length"
    class="partition-charts"
    :class="{ 'is-compact': compact }"
  >
    <div class="chart-box chart-box-map">
      <v-chart class="chart" :option="mapOption" autoresize />
    </div>
    <div
      class="chart-box chart-box-size"
      :style="{ height: `${sizeChartHeight}px` }"
    >
      <v-chart class="chart" :option="sizeOption" autoresize />
    </div>
  </div>
  <div v-else class="charts-empty">
    <PlaceholderHint :text="emptyText" />
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { use } from "echarts/core";
import { BarChart } from "echarts/charts";
import {
  GridComponent,
  TitleComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import VChart from "vue-echarts";
import type { FlashPartition } from "@/utils/partitionBin";
import {
  buildPartitionMapOption,
  buildPartitionSizeOption,
} from "@/utils/partitionChart";
import PlaceholderHint from "@/components/PlaceholderHint.vue";

use([BarChart, GridComponent, TitleComponent, TooltipComponent, CanvasRenderer]);

const props = defineProps<{
  partitions: FlashPartition[];
  emptyText: string;
  compact?: boolean;
}>();

const mapOption = computed(() => buildPartitionMapOption(props.partitions));
const sizeOption = computed(() => buildPartitionSizeOption(props.partitions));

/** 按分区数量撑开高度，避免横条图表底部被裁切 */
const sizeChartHeight = computed(() => {
  const row = 28;
  const chrome = 96;
  return Math.max(220, chrome + props.partitions.length * row);
});
</script>
<style scoped>
.partition-charts {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: auto;
  min-height: 100%;
  box-sizing: border-box;
  padding-bottom: 4px;
}

.charts-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  height: 100%;
}

.chart-box {
  min-width: 0;
  flex-shrink: 0;
  padding: 10px 12px;
  background:
    linear-gradient(180deg, rgba(56, 189, 248, 0.04), transparent 42%),
    rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 8px;
  box-sizing: border-box;
}

.chart-box-map {
  height: 208px;
}

.chart {
  width: 100%;
  height: 100%;
}

.partition-charts:not(.is-compact) .chart-box-map {
  height: 240px;
}
</style>
