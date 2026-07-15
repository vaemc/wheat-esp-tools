import { Command } from "@tauri-apps/plugin-shell";

/** 从 `esptool version` 输出中提取版本号 */
export function parseEsptoolVersion(output: string): string | null {
  const text = output.replace(/\r/g, "").trim();
  if (!text) {
    return null;
  }

  const named = text.match(
    /esptool(?:\.py)?\s+v?(\d+\.\d+(?:\.\d+)?(?:[.-][\w.]+)?)/i
  );
  if (named?.[1]) {
    return named[1];
  }

  const bare = text.match(/\bv?(\d+\.\d+\.\d+(?:[.-][\w.]+)?)\b/);
  return bare?.[1] ?? null;
}

/** 读取捆绑 sidecar 的 esptool 版本（不经终端总线，避免刷屏） */
export async function fetchEsptoolVersion(): Promise<string | null> {
  try {
    const result = await Command.sidecar("bin/esptool", ["version"]).execute();
    return parseEsptoolVersion(`${result.stdout}\n${result.stderr}`);
  } catch {
    return null;
  }
}
