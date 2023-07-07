import { invoke } from "@tauri-apps/api/tauri";
import {
  readTextFile,
  readDir,
  removeFile as rf,
  FileEntry,
} from "@tauri-apps/api/fs";
import { save } from "@tauri-apps/api/dialog";
import { ToolConfig } from "../utils/model";

import { toolListConfig } from "../utils/tools-config";



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
  let data = await invoke("get_serial_port_list") as string[];
  return data;
}

export async function getCurrentDir() {
  let data = await invoke("get_current_dir");
  return data;
}

export async function getPluginList() {
  let data = await invoke("get_plugin_list");
  return data;
}


// export async function getToolListConfig() {
//   let jsonData = JSON.parse(
//     await readTextFile((await getCurrentDir()) + "\\tools.config.json")
//   );
//   return jsonData.filter((x: ToolConfig) => x.isDrop);
// }

export async function getToolListConfig() {
 
  return toolListConfig;
}

export async function getSimpleToolList() {
  let jsonData = JSON.parse(
    await readTextFile((await getCurrentDir()) + "\\tools.config.json")
  );
  return jsonData.filter((x: ToolConfig) => x.isDrop == false);
}

export async function getFirmwareList() {
  let fileList = (await readDir(
    (await getCurrentDir()) + "\\firmware"
  )) as FileEntry[];
  let fileNameList = fileList.map((item) => {
    return item.name;
  });
  return fileNameList;
}

export async function isEspToolExists() {
  let list = (await readDir(
    (await getCurrentDir()) + "\\esptool"
  )) as FileEntry[];
  let result = list.find((x) => x.name?.includes("esptool")) != null;
  if (result) {
    return true;
  }
  return false;
}

export async function openFileInExplorer(path: string) {
  invoke("open_file_in_explorer", { path: path });
}

export async function removeFile(path: string) {
  await rf(path);
}

export function isHexPrefixed(str: string) {
  if (typeof str !== "string") {
    throw new Error(
      "[is-hex-prefixed] value must be type 'string', is currently type " +
        typeof str +
        ", while checking isHexPrefixed."
    );
  }

  return str.slice(0, 2) === "0x";
}

