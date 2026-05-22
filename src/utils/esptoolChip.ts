import { Command } from "@tauri-apps/api/shell";

/** 故意传入无效 chip，从 stderr 报错中获取完整支持列表 */
export async function runEsptoolChipListProbe(): Promise<string> {
  const result = await Command.sidecar("bin/esptool", ["--chip", "q"]).execute();
  return `${result.stdout}\n${result.stderr}`;
}

/**
 * 解析 esptool 无效 --chip 时的提示，例如：
 * 'q' is not one of 'auto', 'esp8266', 'esp32', 'esp32s2', ...
 */
export function parseChipTypesFromEsptoolOutput(output: string): string[] {
  const anchor = output.search(/is not one of/i);
  if (anchor < 0) {
    return [];
  }

  const tail = output.slice(anchor);
  const chips: string[] = [];

  for (const m of tail.matchAll(/'([a-z][a-z0-9]*)'/gi)) {
    const slug = m[1].toLowerCase();
    if (slug === "auto" || slug === "q") {
      continue;
    }
    chips.push(slug.toUpperCase());
  }

  return [...new Set(chips)];
}

/** 列表过短说明解析不完整（例如误匹配到表格竖线截断） */
export function isPlausibleChipList(chips: string[]): boolean {
  return chips.length >= 8;
}
