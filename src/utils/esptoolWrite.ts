import { writeFlash, type FlashItem, type WriteFlashOptions } from "@/utils/espflash";

/** 兼容旧调用名：执行 write-flash */
export async function runEsptoolWriteFlash(
  port: string,
  baud: string,
  items: FlashItem[],
  options: WriteFlashOptions = {}
): Promise<void> {
  await writeFlash(port, baud, items, options);
}

export type { FlashItem, WriteFlashOptions };
