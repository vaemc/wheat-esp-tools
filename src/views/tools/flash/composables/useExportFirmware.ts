import { open } from "@tauri-apps/plugin-dialog";
import { join } from "@tauri-apps/api/path";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import type { Firmware } from "@/model/model";

/** 从完整路径取出文件名（不含目录） */
function fileNameOf(path: string): string {
  return path.replace(/^.*[\\/]/, "");
}

/**
 * 命名：文件名_{固件地址}.扩展名
 * 例：bootloader.bin + 0x1000 → bootloader_0x1000.bin
 */
export function buildFirmwareExportName(path: string, address: string): string {
  const base = fileNameOf(path);
  const lastDot = base.lastIndexOf(".");
  const stem = lastDot > 0 ? base.slice(0, lastDot) : base;
  const ext = lastDot > 0 ? base.slice(lastDot) : "";
  const addr = address.trim().replace(/[<>:"/\\|?*\s]/g, "_");
  return `${stem}_${addr}${ext}`;
}

/**
 * 弹出「选择文件夹」对话框，将固件列表复制到该目录。
 * 取消选择返回 null；成功返回目标目录路径。
 */
export async function exportFirmwareFilesToDir(
  list: Firmware[]
): Promise<string | null> {
  const dir = await open({
    directory: true,
    multiple: false,
  });
  if (!dir || Array.isArray(dir)) {
    return null;
  }

  const usedNames = new Set<string>();
  for (const item of list) {
    let name = buildFirmwareExportName(item.path, item.address);
    if (usedNames.has(name)) {
      const lastDot = name.lastIndexOf(".");
      const stem = lastDot > 0 ? name.slice(0, lastDot) : name;
      const ext = lastDot > 0 ? name.slice(lastDot) : "";
      let i = 2;
      while (usedNames.has(`${stem}_${i}${ext}`)) {
        i += 1;
      }
      name = `${stem}_${i}${ext}`;
    }
    usedNames.add(name);

    const data = await readFile(item.path);
    await writeFile(await join(dir, name), data);
  }

  return dir;
}
