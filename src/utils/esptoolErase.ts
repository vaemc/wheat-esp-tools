import { runEsptoolCollect } from "@/utils/esptoolCli";

/** 执行 esptool erase-region 并等待结束 */
export async function runEsptoolEraseRegion(
  port: string,
  baud: string,
  offset: string,
  size: string
): Promise<void> {
  await runEsptoolCollect(port, baud, "erase-region", [offset, size]);
}
