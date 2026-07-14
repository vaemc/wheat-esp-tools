import { mkdir } from "@tauri-apps/plugin-fs";
import { join, tempDir } from "@tauri-apps/api/path";

/**
 * 在系统临时目录下创建/返回工作子目录。
 * 不要写到 src-tauri/：tauri dev 会监听文件变更并重建窗口。
 */
export async function getTempWorkDir(subdir: string): Promise<string> {
  const dir = await join(await tempDir(), "wheat-esp-tools", subdir);
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    // 已存在
  }
  return dir;
}

export async function joinTempWorkDir(
  subdir: string,
  name: string
): Promise<string> {
  return join(await getTempWorkDir(subdir), name);
}
