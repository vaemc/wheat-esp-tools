import { join } from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

/** 弹出保存对话框写入二进制；取消返回 null */
export async function saveBytesWithDialog(
  bytes: Uint8Array,
  defaultName: string,
  filters: { name: string; extensions: string[] }[]
): Promise<string | null> {
  const path = await save({
    defaultPath: defaultName,
    filters,
  });
  if (!path) {
    return null;
  }
  await writeFile(path, bytes);
  return path;
}

/** 弹出保存对话框写入文本；取消返回 null */
export async function saveTextWithDialog(
  text: string,
  defaultName: string,
  filters: { name: string; extensions: string[] }[]
): Promise<string | null> {
  return saveBytesWithDialog(
    new TextEncoder().encode(text),
    defaultName,
    filters
  );
}

/** 选择目录后批量写入；取消返回 null */
export async function saveFilesToPickedDir(
  files: { name: string; data: Uint8Array }[]
): Promise<string | null> {
  const dir = await open({
    directory: true,
    multiple: false,
  });
  if (!dir || Array.isArray(dir)) {
    return null;
  }
  for (const file of files) {
    await writeFile(await join(dir, file.name), file.data);
  }
  return dir;
}
