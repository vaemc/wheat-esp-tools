import { join, tempDir } from "@tauri-apps/api/path";
import { mkdir, readDir, remove } from "@tauri-apps/plugin-fs";
import { getFileInfo } from "@/utils/common";

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

/**
 * 本地固件目录：`{temp}/wheat-esp-tools/firmware`
 * 合并 / 读 Flash / 固件管理共用；缓存清理时保留。
 */
export async function getFirmwareDir(): Promise<string> {
  return getTempWorkDir("firmware");
}

/** 缓存清理时保留的顶层子目录名（相对 temp 根） */
export const PRESERVED_TEMP_SUBDIRS = new Set(["firmware"]);

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

/**
 * 统计可清理缓存大小：跳过 `PRESERVED_TEMP_SUBDIRS`（如 firmware）。
 */
export async function calcCacheableSizeBytes(root: string): Promise<number> {
  if (!(await dirExists(root))) {
    return 0;
  }
  let total = 0;
  const entries = await readDir(root);
  for (const entry of entries) {
    if (PRESERVED_TEMP_SUBDIRS.has(entry.name)) {
      continue;
    }
    const child = await join(root, entry.name);
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

/**
 * 清理临时工作根下的可清理内容，保留 `PRESERVED_TEMP_SUBDIRS`。
 */
export async function clearCacheableContents(root: string): Promise<void> {
  if (!(await dirExists(root))) {
    return;
  }
  const entries = await readDir(root);
  for (const entry of entries) {
    if (PRESERVED_TEMP_SUBDIRS.has(entry.name)) {
      continue;
    }
    const child = await join(root, entry.name);
    try {
      await remove(child, { recursive: true });
    } catch (error) {
      console.error("[clearCacheableContents]", child, error);
    }
  }
}
