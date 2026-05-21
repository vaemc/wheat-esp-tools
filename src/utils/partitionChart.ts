import type { EChartsOption } from "echarts";
import type { FlashPartition } from "@/utils/partitionBin";
import { formatHexDisplay } from "@/utils/partitionBin";

const CHART_COLORS = [
  "#5470c6",
  "#91cc75",
  "#fac858",
  "#ee6666",
  "#73c0de",
  "#3ba272",
  "#fc8452",
  "#9a60b4",
  "#ea7ccc",
];

const GAP_COLOR = "rgba(255,255,255,0.12)";

function colorAt(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

type StackSegment = {
  name: string;
  value: number;
  color: string;
  start: number;
  end: number;
  isGap: boolean;
};

function buildFlashStackSegments(
  partitions: FlashPartition[]
): StackSegment[] {
  const sorted = [...partitions].sort((a, b) => a.offset - b.offset);
  const segments: StackSegment[] = [];
  let cursor = 0;

  sorted.forEach((p, i) => {
    if (p.offset > cursor) {
      segments.push({
        name: `__gap_${cursor.toString(16)}`,
        value: p.offset - cursor,
        color: GAP_COLOR,
        start: cursor,
        end: p.offset,
        isGap: true,
      });
    }
    segments.push({
      name: p.name,
      value: p.size,
      color: colorAt(i),
      start: p.offset,
      end: p.offset + p.size,
      isGap: false,
    });
    cursor = p.offset + p.size;
  });

  return segments;
}

/** 各分区容量占比 — 南丁格尔玫瑰图 */
export function buildPartitionPieOption(
  partitions: FlashPartition[]
): EChartsOption {
  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      formatter: (params: { name: string; value: number; percent: number }) =>
        `${params.name}<br/>${formatHexDisplay(params.value)} (${params.percent}%)`,
    },
    legend: {
      type: "scroll",
      bottom: 0,
      textStyle: { color: "rgba(255,255,255,0.65)" },
    },
    series: [
      {
        type: "pie",
        roseType: "area",
        radius: ["18%", "72%"],
        center: ["50%", "46%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 3,
          borderColor: "#1a1a1a",
          borderWidth: 1,
        },
        label: {
          color: "rgba(255,255,255,0.85)",
          formatter: "{b}\n{d}%",
        },
        labelLine: {
          lineStyle: { color: "rgba(255,255,255,0.35)" },
        },
        data: partitions.map((p, i) => ({
          name: p.name,
          value: p.size,
          itemStyle: { color: colorAt(i) },
        })),
      },
    ],
  };
}

/** Flash 地址空间 — 堆叠柱状图（自下而上：间隙 + 各分区） */
export function buildPartitionBarOption(
  partitions: FlashPartition[]
): EChartsOption {
  const segments = buildFlashStackSegments(partitions);
  const maxEnd = Math.max(...segments.map((s) => s.end), 0);

  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      formatter: (params: { seriesIndex?: number }) => {
        const seg = segments[params.seriesIndex ?? -1];
        if (!seg) {
          return "";
        }
        const range = `0x${seg.start.toString(16)} ~ 0x${seg.end.toString(16)}`;
        if (seg.isGap) {
          return ["空闲", range, formatHexDisplay(seg.value)].join("<br/>");
        }
        return [seg.name, range, formatHexDisplay(seg.value)].join("<br/>");
      },
    },
    grid: { left: 48, right: 16, top: 12, bottom: 36 },
    xAxis: {
      type: "category",
      data: ["Flash"],
      axisLabel: { color: "rgba(255,255,255,0.85)" },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: maxEnd,
      axisLabel: {
        color: "rgba(255,255,255,0.55)",
        formatter: (v: number) => formatHexDisplay(v),
      },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
    },
    legend: {
      type: "scroll",
      bottom: 0,
      textStyle: { color: "rgba(255,255,255,0.65)" },
      data: segments.filter((s) => !s.isGap).map((s) => s.name),
    },
    series: segments.map((seg) => ({
      name: seg.name,
      type: "bar" as const,
      stack: "flash",
      barWidth: "52%",
      data: [seg.value],
      itemStyle: { color: seg.color },
      emphasis: { focus: "series" as const },
      ...(seg.isGap
        ? { silent: true, legendHoverLink: false }
        : {}),
    })),
  };
}
