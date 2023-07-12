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
import { Path } from "../utils/model";
import moment from "moment";
import { historyPathStore } from "../utils/store";
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

export function addHistoryPath(data: string) {
  let path = data.split("\\");
  let result = {} as Path;
  if (path.length >= 5) {
    let ellipsis = `${path[0]}\\${path[1]}\\${path[2]}\\...\\${
      path[path.length - 2]
    }\\${path[path.length - 1]}`;
    result = { full: data, name: ellipsis };
  } else {
    result = { full: data, name: data };
  }
  let historyPathList = historyPathStore().pathList;
  if (historyPathList.filter((x) => x.full === result.full).length == 0) {
    historyPathStore().pathList.push(result);
  }
}

export async function getSerialPortList() {
  return (await invoke("get_serial_port_list")) as string[];
}

export function selectedPort() {
  return portStore().port;
}

export async function getCurrentDir() {
  return await invoke("get_current_dir");
}

export async function getPluginList() {
  return await invoke("get_plugin_list");
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

let retryCount = 0;

export async function executedCommand(cmd: String[]) {
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

  cmd = cmd.filter((x: String) => x != "");
  let command = new Command("esptool", cmd as string[]);
  command.on("close", (data) => {});
  command.on("error", (error) => terminalWrite(error));
  command.stdout.on("data", async (line) => {
    console.log(line);
    terminalWrite(
      kleur.bold().blue(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] `)
    );
    terminalWriteLine(line);
    if (
      line.includes(
        `A fatal error occurred: Could not open ${selectedPort()}, the port doesn't exist`
      )
    ) {
      if (retryCount != 3) {
        notification["warning"]({
          message: "端口不存在或被占用，正在重试...",
        });

        retryCount++;
        await new Promise((r) => setTimeout(r, 2000));
        executedCommand(cmd);
      } else {
        retryCount = 0;
      }
    }
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

export async function isFile(path: string) {
  return await invoke("is_file", { path: path });
}

export async function removeFile(path: string) {
  await rf(path);
}
