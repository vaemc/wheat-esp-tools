import { invoke } from "@tauri-apps/api/tauri";
import {
  readTextFile,
  readDir,
  removeFile as rf,
  FileEntry,
} from "@tauri-apps/api/fs";
import { save } from "@tauri-apps/api/dialog";

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

export function addHistoryPath(data: string) {
  // let result = {} as Path;
  // result = { full: data, name: data };
  // let historyPathList = JSON.parse(
  //   localStorage.getItem("pathList") as string
  // ) as Path[];
  // if (historyPathList.filter((x) => x.full === result.full).length == 0) {
  //   historyPathList.push(result);
  //   localStorage.setItem("pathList", JSON.stringify(historyPathList));
  // }
}

export async function getSerialPortList() {
  return (await invoke("get_serial_port_list")) as string[];
}

export async function getCurrentDir() {
  return await invoke("get_current_dir");
}

export async function getPluginList() {
  return await invoke("get_plugin_list");
}

export async function writeAllText(path: string, text: string) {
  return await invoke("write_all_text", { path: path, text: text });
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

export async function getFlasherArgs(path: string) {
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

export async function getFlasherArgs2(path: string) {
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

export async function isFile(path: string) {
  return await invoke("is_file", { path: path });
}

export async function collectAllPaths(path: string, level: number) {
  return await invoke("collect_all_paths", { path: path, level: level });
}

export async function getFileSize(path: string) {
  return await invoke("get_file_size", { path: path });
}

export async function removeFile(path: string) {
  await rf(path);
}
