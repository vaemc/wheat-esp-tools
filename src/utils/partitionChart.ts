import type { EChartsOption } from "echarts";
import type { FlashPartition } from "@/utils/partitionBin";
import { formatHexDisplay } from "@/utils/partitionBin";
import {
  formatPartitionAddress,
  formatPartitionMb,
  partitionSubtypeLabel,
  partitionTypeLabel,
} from "@/utils/partitionTableFormat";
import i18n from "@/locales/i18n";

const APP_TYPE = 0x00;
const DATA_TYPE = 0x01;
const BOOTLOADER_TYPE = 0x02;
const PARTITION_TABLE_TYPE = 0x03;

const GAP_COLOR = "rgba(148, 163, 184, 0.16)";

/** 按 ESP 分区类型配色，便于一眼区分 app / data / bootloader */
function colorForPartition(p: FlashPartition, index: number): string {
  if (p.type === APP_TYPE) {
    const tones = ["#38bdf8", "#0ea5e9", "#0284c7", "#67e8f9", "#22d3ee"];
    return tones[index % tones.length];
  }
  if (p.type === DATA_TYPE) {
    const subtype = partitionSubtypeLabel(p.type, p.subtype);
    if (subtype === "nvs" || subtype === "nvs_keys") return "#fbbf24";
    if (subtype === "ota") return "#a78bfa";
    if (subtype === "phy") return "#34d399";
    if (subtype === "coredump") return "#fb7185";
    if (subtype === "fat" || subtype === "spiffs" || subtype === "littlefs") {
      return "#4ade80";
    }
    return ["#f59e0b", "#f97316", "#eab308", "#d97706"][index % 4];
  }
  if (p.type === BOOTLOADER_TYPE) return "#c084fc";
  if (p.type === PARTITION_TABLE_TYPE) return "#94a3b8";
  return ["#64748b", "#78716c", "#737373", "#57534e"][index % 4];
}

type MapSegment = {
  name: string;
  value: number;
  color: string;
  start: number;
  end: number;
  isGap: boolean;
  partition?: FlashPartition;
  /** 图表用显示宽度（小分区已放大，不再等于真实字节） */
  displayValue: number;
  displayStart: number;
};

/**
 * 可读布局：保证每段分区至少占一定视觉比例，
 * 否则 4K/8K/16K 在 14M 总线上只有 1px。
 * X 轴用显示坐标，刻度文字仍为真实 Flash 偏移。
 */
function buildMapSegments(partitions: FlashPartition[]): {
  segments: MapSegment[];
  displayEnd: number;
  addressEnd: number;
} {
  const sorted = [...partitions].sort((a, b) => a.offset - b.offset);
  const raw: Omit<MapSegment, "displayValue" | "displayStart">[] = [];
  let cursor = 0;

  sorted.forEach((p, i) => {
    if (p.offset > cursor) {
      raw.push({
        name: `__gap_${cursor.toString(16)}`,
        value: p.offset - cursor,
        color: GAP_COLOR,
        start: cursor,
        end: p.offset,
        isGap: true,
      });
    }
    raw.push({
      name: p.name,
      value: p.size,
      color: colorForPartition(p, i),
      start: p.offset,
      end: p.offset + p.size,
      isGap: false,
      partition: p,
    });
    cursor = Math.max(cursor, p.offset + p.size);
  });

  const addressEnd = Math.max(cursor, 1);
  const partCount = raw.filter((s) => !s.isGap).length;
  const gapCount = raw.filter((s) => s.isGap).length;

  let minPart = 0.032;
  let minGap = 0.01;
  let reserved = partCount * minPart + gapCount * minGap;
  if (reserved > 0.78) {
    const scale = 0.78 / reserved;
    minPart *= scale;
    minGap *= scale;
    reserved = 0.78;
  }
  const free = 1 - reserved;
  const SCALE = 10000;

  let displayCursor = 0;
  const segments: MapSegment[] = raw.map((seg) => {
    const weight = seg.value / addressEnd;
    const floor = seg.isGap ? minGap : minPart;
    const displayValue = Math.max(1, Math.round((floor + free * weight) * SCALE));
    const displayStart = displayCursor;
    displayCursor += displayValue;
    return { ...seg, displayValue, displayStart };
  });

  return { segments, displayEnd: displayCursor || SCALE, addressEnd };
}

function tooltipForPartition(p: FlashPartition): string {
  const type = partitionTypeLabel(p.type);
  const subtype = partitionSubtypeLabel(p.type, p.subtype);
  const range = `${formatHexDisplay(p.offset)} → ${formatHexDisplay(
    p.offset + p.size
  )}`;
  return [
    `<b>${p.name}</b>`,
    `${i18n.global.t("partition.colType")}: ${type} / ${subtype}`,
    `${i18n.global.t("partition.colOffset")}: ${range}`,
    `${i18n.global.t("partition.colSize")}: ${formatPartitionAddress(p.size, true)} (${formatHexDisplay(p.size)})`,
  ].join("<br/>");
}

/** Flash 地址布局图：按偏移横向排开，间隙可见；小分区放大以便可读 */
export function buildPartitionMapOption(
  partitions: FlashPartition[]
): EChartsOption {
  const { segments, displayEnd, addressEnd } = buildMapSegments(partitions);
  const used = partitions.reduce((sum, p) => sum + p.size, 0);
  const gap = Math.max(0, addressEnd - used);

  // 刻度钉在各段显示起点，文字为真实偏移（与表格「偏移」对应）
  const tickItems = segments
    .filter((s) => !s.isGap)
    .map((s) => ({ display: s.displayStart, address: s.start }));
  tickItems.unshift({ display: 0, address: 0 });
  tickItems.push({ display: displayEnd, address: addressEnd });
  const tickValues = tickItems.map((t) => t.display);
  const tickLabelMap = new Map(tickItems.map((t) => [t.display, t.address]));

  return {
    backgroundColor: "transparent",
    title: {
      text: i18n.global.t("partition.chartMap"),
      subtext: [
        i18n.global.t("partition.chartMapSub", {
          used: formatPartitionMb(used),
          end: formatPartitionMb(addressEnd),
          gap: formatPartitionMb(gap),
        }),
        i18n.global.t("partition.chartMapBoost"),
      ].join("\n"),
      left: 4,
      top: 0,
      textStyle: {
        color: "rgba(255,255,255,0.88)",
        fontSize: 13,
        fontWeight: 600,
      },
      subtextStyle: {
        color: "rgba(255,255,255,0.42)",
        fontSize: 11,
        lineHeight: 16,
      },
    },
    tooltip: {
      trigger: "item",
      confine: true,
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        const seg = segments[p.seriesIndex ?? -1];
        if (!seg) return "";
        if (seg.isGap) {
          return [
            `<b>${i18n.global.t("partition.free")}</b>`,
            `${formatPartitionAddress(seg.start, false)} → ${formatPartitionAddress(seg.end, false)}`,
            formatPartitionAddress(seg.value, true),
          ].join("<br/>");
        }
        return seg.partition ? tooltipForPartition(seg.partition) : seg.name;
      },
    },
    grid: {
      left: 72,
      right: 28,
      top: 68,
      bottom: 58,
      containLabel: false,
    },
    xAxis: {
      type: "value",
      min: 0,
      max: displayEnd,
      axisTick: {
        customValues: tickValues,
      },
      axisLabel: {
        customValues: tickValues,
        color: "rgba(255,255,255,0.55)",
        fontSize: 10,
        rotate: tickValues.length > 6 ? 35 : 0,
        hideOverlap: false,
        formatter: (v: number) =>
          formatPartitionAddress(tickLabelMap.get(v) ?? v, false),
      },
      splitLine: {
        show: true,
        lineStyle: { color: "rgba(255,255,255,0.05)" },
      },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.18)" } },
    },
    yAxis: {
      type: "category",
      data: ["Flash"],
      axisLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: segments.map((seg) => ({
      name: seg.name,
      type: "bar" as const,
      stack: "flash-map",
      barWidth: 36,
      data: [seg.displayValue],
      itemStyle: {
        color: seg.color,
        borderColor: seg.isGap ? "transparent" : "rgba(10,14,22,0.55)",
        borderWidth: seg.isGap ? 0 : 1,
        borderRadius: 2,
      },
      label: {
        show: !seg.isGap && seg.displayValue / displayEnd >= 0.045,
        formatter: () => seg.name,
        color: "rgba(255,255,255,0.92)",
        fontSize: 11,
        fontWeight: 500,
      },
      emphasis: {
        disabled: seg.isGap,
        focus: "self" as const,
        itemStyle: {
          shadowBlur: 10,
          shadowColor: "rgba(56,189,248,0.35)",
        },
      },
      ...(seg.isGap ? { silent: false, legendHoverLink: false } : {}),
    })),
  };
}

/** 分区容量横向对比（按地址顺序） */
export function buildPartitionSizeOption(
  partitions: FlashPartition[]
): EChartsOption {
  const sorted = [...partitions].sort((a, b) => a.offset - b.offset);
  const names = sorted.map((p) => p.name);
  const total = sorted.reduce((s, p) => s + p.size, 0) || 1;

  return {
    backgroundColor: "transparent",
    title: {
      text: i18n.global.t("partition.chartSize"),
      subtext: i18n.global.t("partition.chartSizeSub"),
      left: 4,
      top: 0,
      textStyle: {
        color: "rgba(255,255,255,0.88)",
        fontSize: 13,
        fontWeight: 600,
      },
      subtextStyle: {
        color: "rgba(255,255,255,0.42)",
        fontSize: 11,
      },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      confine: true,
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        const idx = Number(p.dataIndex ?? -1);
        const part = sorted[idx];
        if (!part) return "";
        const pct = ((part.size / total) * 100).toFixed(1);
        return `${tooltipForPartition(part)}<br/>${i18n.global.t(
          "partition.chartShare",
          { pct }
        )}`;
      },
    },
    grid: {
      left: 96,
      right: 56,
      top: 52,
      bottom: 12,
      containLabel: false,
    },
    xAxis: {
      type: "value",
      min: 0,
      show: false,
    },
    yAxis: {
      type: "category",
      data: names,
      inverse: true,
      axisLabel: {
        color: "rgba(255,255,255,0.78)",
        fontSize: 12,
        width: 84,
        overflow: "truncate",
      },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 18,
        data: sorted.map((p, i) => ({
          value: p.size,
          itemStyle: {
            color: colorForPartition(p, i),
            borderRadius: [0, 4, 4, 0],
          },
        })),
        label: {
          show: true,
          position: "right",
          color: "rgba(255,255,255,0.55)",
          fontSize: 11,
          formatter: (params) => {
            const idx = Number(
              (Array.isArray(params) ? params[0] : params).dataIndex ?? -1
            );
            const part = sorted[idx];
            return part ? formatPartitionAddress(part.size, true) : "";
          },
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 8,
            shadowColor: "rgba(0,0,0,0.35)",
          },
        },
      },
    ],
  };
}

/** @deprecated 保留别名，避免外部旧引用断裂 */
export function buildPartitionPieOption(partitions: FlashPartition[]) {
  return buildPartitionMapOption(partitions);
}

/** @deprecated 保留别名，避免外部旧引用断裂 */
export function buildPartitionBarOption(partitions: FlashPartition[]) {
  return buildPartitionSizeOption(partitions);
}
