import type { PinInfo } from "../chips/types";

export interface Category {
  id: string;
  labelKey?: string;
  label: string;
  color: string;
  textColor: string;
  description: string;
  match: (pin: PinInfo) => boolean;
}

const containsAny = (haystack: string, needles: string[]) =>
  needles.some((n) => haystack.toUpperCase().includes(n.toUpperCase()));

const anyIomuxIncludes = (pin: PinInfo, needles: string[]) =>
  pin.iomux.some((f) => containsAny(f.name, needles));

const anyLpioIncludes = (pin: PinInfo, needles: string[]) =>
  pin.lpio.some((f) => containsAny(f.name, needles));

const anyAnalogIncludes = (pin: PinInfo, needles: string[]) =>
  pin.analog.some((a) => containsAny(a, needles));

export const CATEGORIES: Category[] = [
  {
    id: "boot",
    label: "Boot / Strapping",
    color: "#dc2626",
    textColor: "#ffffff",
    description: "复位时被采样的 Strapping 引脚 (启动模式 / VDD_SPI / JTAG / 日志)",
    match: (p) => !!p.strapping,
  },
  {
    id: "power",
    label: "电源 / GND",
    color: "#f59e0b",
    textColor: "#1a1300",
    description: "电源管脚 (VDD / GND / VBAT)",
    match: (p) =>
      p.type.includes("电源") ||
      /^Power/i.test(p.type) ||
      /^GND$/i.test(p.name) ||
      /^VDD/i.test(p.name) ||
      /^VBAT/i.test(p.name) ||
      /VDDO/i.test(p.name),
  },
  {
    id: "gpio",
    label: "普通 GPIO",
    color: "#3b82f6",
    textColor: "#ffffff",
    description: "通用输入输出",
    match: (p) =>
      (p.type === "IO" || p.type.includes("IO")) &&
      !p.type.includes("专用") &&
      !/^VDD|^GND|^Power/i.test(p.type),
  },
  {
    id: "lp",
    label: "LP 低功耗 IO",
    color: "#14b8a6",
    textColor: "#ffffff",
    description: "低功耗域 GPIO（深睡眠仍可用）",
    match: (p) => p.lpio.length > 0,
  },
  {
    id: "adc",
    label: "ADC 模数转换",
    color: "#22c55e",
    textColor: "#03200d",
    description: "ADC 输入通道",
    match: (p) => anyAnalogIncludes(p, ["ADC"]),
  },
  {
    id: "touch",
    label: "Touch 触摸",
    color: "#a855f7",
    textColor: "#ffffff",
    description: "电容触摸通道",
    match: (p) => anyAnalogIncludes(p, ["TOUCH"]),
  },
  {
    id: "uart",
    label: "UART 串口",
    color: "#f97316",
    textColor: "#ffffff",
    description: "UART 默认管脚",
    match: (p) =>
      anyIomuxIncludes(p, ["UART"]) || anyLpioIncludes(p, ["LP_UART"]),
  },
  {
    id: "spi",
    label: "SPI",
    color: "#0ea5e9",
    textColor: "#ffffff",
    description: "SPI 总线管脚",
    match: (p) => anyIomuxIncludes(p, ["SPI"]),
  },
  {
    id: "jtag",
    label: "JTAG / 调试",
    color: "#eab308",
    textColor: "#1a1500",
    description: "JTAG (MTCK/MTDI/MTMS/MTDO)",
    match: (p) => anyIomuxIncludes(p, ["MTCK", "MTDI", "MTMS", "MTDO"]),
  },
  {
    id: "usb",
    label: "USB",
    color: "#06b6d4",
    textColor: "#003035",
    description: "USB OTG / USB1P PHY",
    match: (p) =>
      anyIomuxIncludes(p, ["USB"]) ||
      anyAnalogIncludes(p, ["USB"]) ||
      /^DM$|^DP$/i.test(p.name),
  },
  {
    id: "mipi",
    label: "MIPI DSI / CSI",
    color: "#ec4899",
    textColor: "#ffffff",
    description: "MIPI 显示 / 摄像头接口",
    match: (p) =>
      /DSI|CSI|MIPI/i.test(p.name) || anyIomuxIncludes(p, ["MIPI"]),
  },
  {
    id: "flash",
    label: "Flash / PSRAM",
    color: "#6366f1",
    textColor: "#ffffff",
    description: "Flash / PSRAM 专用 IO",
    match: (p) =>
      /^FLASH/i.test(p.name) ||
      /PSRAM/i.test(p.name) ||
      /VDDO_FLASH|VDDO_PSRAM|VDD_FLASHIO/i.test(p.name),
  },
  {
    id: "gmac",
    label: "以太网 GMAC",
    color: "#84cc16",
    textColor: "#0a1100",
    description: "以太网 RMII 管脚",
    match: (p) => anyIomuxIncludes(p, ["GMAC"]),
  },
  {
    id: "sdio",
    label: "SDIO / SD1",
    color: "#d946ef",
    textColor: "#ffffff",
    description: "SDIO 主机/从机",
    match: (p) => anyIomuxIncludes(p, ["SD1", "SDIO"]),
  },
  {
    id: "analog",
    label: "模拟功能",
    color: "#ef4444",
    textColor: "#ffffff",
    description: "模拟管脚 (XTAL/DCDC/CHIP_PU)",
    match: (p) =>
      (p.type.includes("模拟") || /^Analog$/i.test(p.type)) &&
      !/^VDD|^GND/i.test(p.name),
  },
  {
    id: "comp",
    label: "模拟比较器",
    color: "#fb7185",
    textColor: "#ffffff",
    description: "ANA_COMP 模拟比较器",
    match: (p) => anyAnalogIncludes(p, ["ANA_COMP"]),
  },
];

export const CATEGORY_BY_ID: Record<string, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c])
);

/** Returns the primary category id for a pin (used for default coloring). */
export function primaryCategory(pin: PinInfo): string {
  if (CATEGORY_BY_ID.power!.match(pin)) return "power";
  if (CATEGORY_BY_ID.flash!.match(pin)) return "flash";
  if (CATEGORY_BY_ID.mipi!.match(pin)) return "mipi";
  if (CATEGORY_BY_ID.usb!.match(pin)) return "usb";
  if (CATEGORY_BY_ID.analog!.match(pin)) return "analog";
  if (CATEGORY_BY_ID.adc!.match(pin)) return "adc";
  if (CATEGORY_BY_ID.touch!.match(pin)) return "touch";
  if (CATEGORY_BY_ID.lp!.match(pin)) return "lp";
  if (CATEGORY_BY_ID.gpio!.match(pin)) return "gpio";
  return "gpio";
}

/** Returns ALL category ids that match a pin (used for filtering / chips). */
export function allCategories(pin: PinInfo): string[] {
  return CATEGORIES.filter((c) => c.match(pin)).map((c) => c.id);
}
