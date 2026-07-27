import { ref } from "vue";

export const BAUD_RATE_OPTIONS = [
  "115200",
  "230400",
  "460800",
  "921600",
  "1152000",
  "1500000",
] as const;

export const READ_BAUD_RATE_OPTIONS = [
  "115200",
  "230400",
  "460800",
  "921600",
] as const;

export function toBaudSelectOptions(
  rates: readonly string[] = BAUD_RATE_OPTIONS
) {
  return rates.map((value) => ({ label: value, value }));
}

/** 跨页面共享的烧录选项（模块级单例，避免各页各自一份默认值） */
const baudRate = ref("1152000");
const spiMode = ref("dio");
const eraseBeforeFlash = ref(false);

/** 烧录共用的 SPI、波特率与烧录选项（烧录后校验固定开启，无需选项） */
export function useFlashOptions() {
  return {
    baudRate,
    spiMode,
    eraseBeforeFlash,
  };
}
