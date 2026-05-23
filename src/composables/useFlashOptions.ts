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

/** 烧录共用的 SPI、波特率、擦除选项 */
export function useFlashOptions() {
  const baudRate = ref("1152000");
  const spiMode = ref("keep");
  const eraseBeforeFlash = ref(false);

  return { baudRate, spiMode, eraseBeforeFlash };
}
