import { eraseRegion, type WriteFlashOptions } from "@/utils/espflash";

/** 兼容旧调用名：erase-region */
export async function runEsptoolEraseRegion(
  port: string,
  baud: string,
  offset: string,
  size: string,
  options: Pick<WriteFlashOptions, "before" | "after"> = {}
): Promise<void> {
  await eraseRegion(port, baud, offset, size, options);
}
