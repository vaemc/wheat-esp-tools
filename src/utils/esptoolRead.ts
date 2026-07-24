import { readFlash } from "@/utils/espflash";

/** 兼容旧调用名：read-flash */
export async function runEsptoolReadFlash(
  port: string,
  baud: string,
  offset: string,
  size: string,
  savePath: string
): Promise<void> {
  await readFlash(port, baud, offset, size, savePath);
}
