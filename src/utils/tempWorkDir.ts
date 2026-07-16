import { join, tempDir } from "@tauri-apps/api/path";
import { mkdir, readDir, remove } from "@tauri-apps/plugin-fs";
import { getCurrentDir, getFileInfo } from "@/utils/common";

/**
 * 在系统临时目录下创建/返回工作子目录。
 * 不要写到 src-tauri/：tauri dev 会监听文件变更并重建窗口。
 */
export async function getTempWorkDir(subdir: string): Promise<string> {
  const dir = await join(await getTempWorkRoot(), subdir);
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

/** 应用临时工作根目录：`{temp}/wheat-esp-tools` */
export async function getTempWorkRoot(): Promise<string> {
  const dir = await join(await tempDir(), "wheat-esp-tools");
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    // 已存在
  }
  return dir;
}

/** 应用 cwd 下的 firmware 目录（合并/读 Flash 等产出） */
export async function getFirmwareDir(): Promise<string> {
  const dir = await join(await getCurrentDir(), "firmware");
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    // 已存在
  }
  return dir;
}

async function dirExists(path: string): Promise<boolean> {
  try {
    const info = await getFileInfo(path);
    return info.isDir;
  } catch {
    return false;
  }
}

/** 递归统计目录占用字节数 */
export async function calcDirSizeBytes(dir: string): Promise<number> {
  if (!(await dirExists(dir))) {
    return 0;
  }
  let total = 0;
  const entries = await readDir(dir);
  for (const entry of entries) {
    const child = await join(dir, entry.name);
    try {
      const info = await getFileInfo(child);
      if (info.isDir) {
        total += await calcDirSizeBytes(child);
      } else if (info.isFile) {
        total += info.len;
      }
    } catch {
      // 跳过无法访问的条目
    }
  }
  return total;
}

/** 清空目录内容，保留目录本身 */
export async function clearDirContents(dir: string): Promise<void> {
  if (!(await dirExists(dir))) {
    return;
  }
  const entries = await readDir(dir);
  for (const entry of entries) {
    const child = await join(dir, entry.name);
    try {
      await remove(child, { recursive: true });
    } catch (error) {
      console.error("[clearDirContents]", child, error);
    }
  }
}
