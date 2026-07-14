import { createDir } from "@tauri-apps/api/fs";
import { tempdir } from "@tauri-apps/api/os";
import { join } from "@tauri-apps/api/path";

/**
 * 在系统临时目录下创建/返回工作子目录。
 * 不要写到 src-tauri/：tauri dev 会监听文件变更并重建窗口。
 */
export async function getTempWorkDir(subdir: string): Promise<string> {
  const dir = await join(await tempdir(), "wheat-esp-tools", subdir);
  try {
    await createDir(dir, { recursive: true });
  } catch {
    // 已存在
  }
  return dir;
}
