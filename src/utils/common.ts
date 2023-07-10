import { invoke } from "@tauri-apps/api/tauri";
import {
  readTextFile,
  readDir,
  removeFile as rf,
  FileEntry,
} from "@tauri-apps/api/fs";
import { save } from "@tauri-apps/api/dialog";
import { portStore } from "./store";
import { Command } from "@tauri-apps/api/shell";
import { terminalWrite, terminalWriteLine, refreshFirmwareList } from "./bus";
import { message } from "ant-design-vue";
import moment from "moment";
import { balanced } from "./balanced-match";
import { notification, Button } from "ant-design-vue";
import { h } from "vue";

import kleur from "kleur";

const currentDir = await getCurrentDir();

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
  let data = (await invoke("get_serial_port_list")) as string[];
  return data;
}

export function selectedPort() {
  const port = portStore().port;
  return port;
}

export async function getCurrentDir() {
  let data = await invoke("get_current_dir");
  return data;
}

export async function getPluginList() {
  let data = await invoke("get_plugin_list");
  return data;
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
  let fileNameList = fileList.map((item) => {
    return item.name;
  });
  return fileNameList;
}

export async function esptoolExists() {
  let list = (await readDir(
    (await getCurrentDir()) + "\\esptool"
  )) as FileEntry[];
  let result = list.find((x) => x.name?.includes("esptool")) != null;
  if (result) {
    return true;
  }
  return false;
}

export async function executedCommand(cmd: string[]) {
  let result = await esptoolExists();
  if (!result) {
    notification.open({
      message: "未检测到esptool",
      description: "请将esptool放在软件根目录esptool文件夹！",
      btn: () =>
        h(
          Button,
          {
            type: "primary",
            size: "small",
            onClick: () => {
              openFileInExplorer(currentDir + "\\esptool");
            },
          },
          {
            default: () => "打开文件夹",
          }
        ),
    });

    return;
  }

  cmd = cmd.filter((x: string) => x != "");
  const command = new Command("esptool", cmd);
  command.on("close", (data) => {});
  command.on("error", (error) => terminalWrite(error));
  command.stdout.on("data", (line) => {
    console.log(line);
    terminalWrite(
      kleur.bold().blue(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] `)
    );
    terminalWriteLine(line);
  });
  command.stderr.on("data", (line) => {
    console.log(line);
    terminalWrite(moment().format("YYYY-MM-DD HH:mm:ss"));
    terminalWriteLine(line);
  });
  const child = await command.spawn();

  await new Promise((r) => setTimeout(r, 2500));
  await refreshFirmwareList();
  //console.log("pid:", child.pid);
}

export async function openFileInExplorer(path: string) {
  invoke("open_file_in_explorer", { path: path });
}

export async function removeFile(path: string) {
  await rf(path);
}

