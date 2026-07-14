import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { readTextFile, readDir, remove } from "@tauri-apps/plugin-fs";
import { FileInfo, Firmware } from "@/model/model";
import type { SerialPortDetail } from "@/types/serial";
import {
  isPlausibleChipList,
  parseChipTypesFromEsptoolOutput,
  runEsptoolChipListProbe,
} from "@/utils/esptoolChip";

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

/** 通过 esptool --chip q 报错信息解析当前版本支持的芯片（大写，如 ESP32S3） */
export async function getChipTypeList(): Promise<string[]> {
  if (cachedChipTypes && isPlausibleChipList(cachedChipTypes)) {
    return cachedChipTypes;
  }

  const output = await runEsptoolChipListProbe();
  const chips = parseChipTypesFromEsptoolOutput(output);

  if (!isPlausibleChipList(chips)) {
    cachedChipTypes = null;
    throw new Error(
      `Failed to parse chip list from esptool (${chips.length} chips)`
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
  let config = JSON.parse(await readTextFile(path));
  const folderPath = path.substring(0, path.lastIndexOf("\\"));
  let list = {
    appName: config.app.file.split(".")[0],
    chip: config.extra_esptool_args.chip.toUpperCase(),
    flashFiles: [] as Firmware[],
  };

  for (const item of Object.keys(config.flash_files)) {
    const fullPath =
      folderPath + "\\" + config.flash_files[item].replace(/\//g, "\\");
    list.flashFiles.push({
      check: true,
      path: fullPath,
      address: item,
    });
  }

  return list;
}

export async function getPlatformIOArgsConfig(path: string) {
  let config = JSON.parse(await readTextFile(path));
  const folderPath = path.substring(0, path.lastIndexOf("\\"));
  let list = {
    appName: config.env_name,
    chip: "",
    flashFiles: [] as Firmware[],
  };

  list.flashFiles.push({
    check: true,
    path: `${folderPath}\\firmware.bin`,
    address: config.extra.application_offset,
  });

  await Promise.all(
    config.extra.flash_images.map(async (item: any) => {
      list.flashFiles.push({
        check: true,
        path: item.path,
        address: item.offset,
      });
    })
  );

  return list;
}

export async function openFileInExplorer(path: string) {
  invoke("open_file_in_explorer", { path: path });
}

export async function openDirectoryInExplorer(path: string) {
  invoke("open_directory_in_explorer", { path: path });
}

export async function getFileInfo(path: string) {
  const info = (await invoke("get_file_info", { path: path })) as any;
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
