import { invoke } from "@tauri-apps/api/core";
import { dirname, join } from "@tauri-apps/api/path";
import { readTextFile, readDir, remove } from "@tauri-apps/plugin-fs";
import { FileInfo, Firmware } from "@/model/model";
import type { SerialPortDetail } from "@/types/serial";
import {
  isPlausibleChipList,
  runEsptoolChipListProbe,
} from "@/utils/esptoolChip";
import { CONFIG_FILENAMES } from "@/utils/path";

interface RustFileInfo {
  name: string;
  is_dir: boolean;
  is_file: boolean;
  len: number;
  create_time: number;
}

interface FlashImageEntry {
  path?: string;
  offset?: string;
}

export async function getSerialPortList() {
  return (await invoke("get_serial_port_list")) as string[];
}

export async function getSerialPortDetails() {
  return (await invoke("get_serial_port_details")) as SerialPortDetail[];
}

export async function getCurrentDir() {
  return (await invoke("get_current_dir")) as string;
}

let cachedChipTypes: string[] | null = null;

/** 从内置 espflash 获取支持的芯片列表（大写，如 ESP32S3） */
export async function getChipTypeList(): Promise<string[]> {
  if (cachedChipTypes && isPlausibleChipList(cachedChipTypes)) {
    return cachedChipTypes;
  }

  const chips = await runEsptoolChipListProbe();

  if (!isPlausibleChipList(chips)) {
    cachedChipTypes = null;
    throw new Error(
      `Failed to load chip list from espflash (${chips.length} chips)`
    );
  }

  cachedChipTypes = chips;
  return chips;
}

export async function getFirmwareList() {
  const dir = await join(await getCurrentDir(), "firmware");
  const fileList = await readDir(dir);
  return Promise.all(fileList.map((item) => join(dir, item.name)));
}

export async function getIDFArgsConfig(path: string) {
  let config: Record<string, unknown>;
  try {
    config = JSON.parse(await readTextFile(path)) as Record<string, unknown>;
  } catch (e) {
    throw new Error(`无法解析 flasher_args.json: ${e}`);
  }

  const app = config.app as { file?: string } | undefined;
  const extra = config.extra_esptool_args as { chip?: string } | undefined;
  const flashFiles = config.flash_files as Record<string, string> | undefined;
  if (!app?.file || !extra?.chip || !flashFiles) {
    throw new Error("flasher_args.json 缺少 app / extra_esptool_args / flash_files");
  }

  const folderPath = await dirname(path);
  const list = {
    appName: app.file.split(".")[0],
    chip: extra.chip.toUpperCase(),
    flashFiles: [] as Firmware[],
  };

  for (const item of Object.keys(flashFiles)) {
    const relative = String(flashFiles[item]).replace(/\\/g, "/");
    list.flashFiles.push({
      check: true,
      path: await join(folderPath, ...relative.split("/").filter(Boolean)),
      address: item,
    });
  }

  return list;
}

export async function getPlatformIOArgsConfig(path: string) {
  let config: Record<string, unknown>;
  try {
    config = JSON.parse(await readTextFile(path)) as Record<string, unknown>;
  } catch (e) {
    throw new Error(`无法解析 idedata.json: ${e}`);
  }

  const extra = config.extra as {
    application_offset?: string;
    flash_images?: FlashImageEntry[];
  } | undefined;
  if (!config.env_name || !extra?.application_offset) {
    throw new Error("idedata.json 缺少 env_name / extra.application_offset");
  }

  const folderPath = await dirname(path);
  const list = {
    appName: String(config.env_name),
    chip: "",
    flashFiles: [] as Firmware[],
  };

  list.flashFiles.push({
    check: true,
    path: await join(folderPath, "firmware.bin"),
    address: String(extra.application_offset),
  });

  const images = extra.flash_images ?? [];
  for (const item of images) {
    if (!item?.path || item.offset == null) {
      continue;
    }
    const relative = String(item.path).replace(/\\/g, "/");
    const absPath =
      /^[a-zA-Z]:\//.test(relative) || relative.startsWith("/")
        ? item.path
        : await join(folderPath, ...relative.split("/").filter(Boolean));
    list.flashFiles.push({
      check: true,
      path: absPath,
      address: String(item.offset),
    });
  }

  return list;
}

export async function openFileInExplorer(path: string) {
  try {
    await invoke("open_file_in_explorer", { path });
  } catch (err) {
    console.error("[openFileInExplorer]", err);
  }
}

export async function openDirectoryInExplorer(path: string) {
  try {
    await invoke("open_directory_in_explorer", { path });
  } catch (err) {
    console.error("[openDirectoryInExplorer]", err);
  }
}

export async function getFileInfo(path: string) {
  const info = (await invoke("get_file_info", { path })) as RustFileInfo;
  return {
    name: info.name,
    isFile: info.is_file,
    isDir: info.is_dir,
    len: info.len,
    createTime: info.create_time,
  } as FileInfo;
}

export async function removeFile(path: string) {
  await remove(path);
}

export { CONFIG_FILENAMES };
