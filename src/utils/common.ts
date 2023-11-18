import { invoke } from "@tauri-apps/api/tauri";
import {
  readTextFile,
  writeTextFile,
  readDir,
  removeFile as rf,
  FileEntry,
} from "@tauri-apps/api/fs";
import { save } from "@tauri-apps/api/dialog";
import { FileInfo } from "@/model/model";

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
  return await writeTextFile(path,text);
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

export async function getFlasherArgs2(path: string) {
  let flasherArgs = JSON.parse(
    await readTextFile(`${path}\\flasher_args.json`)
  );
  const flattenedList = [
    ...(Object.keys(flasherArgs.flash_files) as string[]).map((item) => {
      return [item, `${path}\\${flasherArgs.flash_files[item]}`];
    }),
  ].reduce((accumulator: any, currentValue: any) => {
    return accumulator.concat(currentValue);
  }, []);
  return {
    appName: flasherArgs.app.file.split(".")[0],
    chip: flasherArgs.extra_esptool_args.chip,
    flashArgs: flattenedList,
  };
}

export async function getFlasherArgs(path: string) {
  let flasherArgs = JSON.parse(await readTextFile(path));
  console.log(flasherArgs);

  return {
    appName: flasherArgs.app.file.split(".")[0],
    chip: flasherArgs.extra_esptool_args.chip,
    flashFiles: flasherArgs.flash_files,
  };
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
    isFile: info.is_file,
    isDir: info.is_dir,
    len: info.len,
    createTime: info.create_time,
  } as FileInfo;
}

export async function collectAllPaths(path: string, level: number) {
  return await invoke("collect_all_paths", { path: path, level: level });
}

export async function removeFile(path: string) {
  await rf(path);
}
