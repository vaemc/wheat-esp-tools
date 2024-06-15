import { invoke } from "@tauri-apps/api/tauri";
import {
  readTextFile,
  writeTextFile,
  readDir,
  removeFile as rf,
  FileEntry,
} from "@tauri-apps/api/fs";
import { save } from "@tauri-apps/api/dialog";
import { FileInfo, Firmware } from "@/model/model";
import prettyBytes from "pretty-bytes";

export async function saveFileDialog() {
  const filePath = await save({
    filters: [
      {
        name: "Bin",
        extensions: ["bin"],
      },
    ],
  });

  return filePath;
}

export async function getSerialPortList() {
  return (await invoke("get_serial_port_list")) as string[];
}

export async function getCurrentDir() {
  return await invoke("get_current_dir");
}

export async function writeAllText(path: string, text: string) {
  return await writeTextFile(path, text);
}

export async function getChipTypeList() {
  let jsonData = JSON.parse(
    await readTextFile((await getCurrentDir()) + "\\chip.list.json")
  );
  return jsonData;
}

export async function getFirmwareList() {
  let fileList = (await readDir(
    (await getCurrentDir()) + "\\firmware"
  )) as FileEntry[];
  return fileList.map((item) => {
    return item.path;
  });
}

export async function getIDFArgsConfig(path: string) {
  let config = JSON.parse(await readTextFile(path));
  const folderPath = path.substring(0, path.lastIndexOf("\\"));
  let list = {
    appName: config.app.file.split(".")[0],
    chip: config.extra_esptool_args.chip.toUpperCase(),
    flashFiles: [] as Firmware[],
  };

  Object.keys(config.flash_files).map(async (item) => {
    const fullPath =
      folderPath + "\\" + config.flash_files[item].replace(/\//g, "\\");
    list.flashFiles.push({
      check: true,
      path: fullPath,
      address: item,
    });
  });

  return list;
}

export async function getPlatformIOArgsConfig(path: string) {
  let config = JSON.parse(await readTextFile(path));
  const folderPath = path.substring(0, path.lastIndexOf("\\"));
  // const regex = /ARDUINO_VARIANT=\\"(.*?)\\"/;
  // let match = JSON.stringify(config.defines).match(regex)!;
  let list = {
    appName: config.env_name,
    // chip: match[1].toUpperCase(),
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
  await rf(path);
}
