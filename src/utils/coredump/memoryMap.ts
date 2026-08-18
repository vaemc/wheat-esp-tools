/** ESP32 / S3 常见地址窗口，用于一眼判断 PC / EXCVADDR 落在哪类内存 */

export type MemTone = "danger" | "code" | "data" | "io" | "muted";

export interface MemRegion {
  id: string;
  labelKey: string;
  tone: MemTone;
}

const UNKNOWN: MemRegion = {
  id: "unknown",
  labelKey: "crash.mem.unknown",
  tone: "muted",
};

export function classifyEspAddr(addr: number): MemRegion {
  const a = addr >>> 0;
  if (a < 0x10000) {
    return { id: "null", labelKey: "crash.mem.null", tone: "danger" };
  }
  // ESP32-S3
  if (a >= 0x42000000 && a < 0x44000000) {
    return { id: "irom", labelKey: "crash.mem.irom", tone: "code" };
  }
  if (a >= 0x40370000 && a < 0x403e0000) {
    return { id: "iram", labelKey: "crash.mem.iram", tone: "code" };
  }
  if (a >= 0x3fc80000 && a < 0x3fd00000) {
    return { id: "dram", labelKey: "crash.mem.dram", tone: "data" };
  }
  if (a >= 0x3c000000 && a < 0x3e000000) {
    return { id: "ext", labelKey: "crash.mem.ext", tone: "data" };
  }
  if (a >= 0x50000000 && a < 0x50004000) {
    return { id: "rtc", labelKey: "crash.mem.rtc", tone: "data" };
  }
  if (a >= 0x60000000 && a < 0x60100000) {
    return { id: "periph", labelKey: "crash.mem.periph", tone: "io" };
  }
  // ESP32
  if (a >= 0x400d0000 && a < 0x40400000) {
    return { id: "irom", labelKey: "crash.mem.irom", tone: "code" };
  }
  if (a >= 0x40000000 && a < 0x40080000) {
    return { id: "iram", labelKey: "crash.mem.iram", tone: "code" };
  }
  if (a >= 0x3ff80000 && a < 0x40000000) {
    return { id: "dram", labelKey: "crash.mem.dram", tone: "data" };
  }
  if (a >= 0x3f400000 && a < 0x3f800000) {
    return { id: "drom", labelKey: "crash.mem.drom", tone: "data" };
  }
  if (a >= 0x3f800000 && a < 0x3fc00000) {
    return { id: "ext", labelKey: "crash.mem.ext", tone: "data" };
  }
  return UNKNOWN;
}
