import { runEsptoolCollect } from "@/utils/esptoolCli";

/** 执行 esptool read-flash 并等待结束 */
export async function runEsptoolReadFlash(
  port: string,
  baud: string,
  offset: string,
  size: string,
  savePath: string
): Promise<void> {
  await runEsptoolCollect(port, baud, "read-flash", [offset, size, savePath]);
}
