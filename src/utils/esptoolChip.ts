import { listSupportedChips } from "@/utils/espflash";

/** 列表过短说明解析不完整 */
export function isPlausibleChipList(chips: string[]): boolean {
  return chips.length >= 8;
}

/** 直接从 espflash Chip 枚举获取支持列表 */
export async function runEsptoolChipListProbe(): Promise<string[]> {
  return listSupportedChips();
}

/** @deprecated 保留空实现签名兼容；新逻辑不再解析 CLI 文本 */
export function parseChipTypesFromEsptoolOutput(_output: string): string[] {
  return [];
}
