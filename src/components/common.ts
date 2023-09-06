import { invoke } from "@tauri-apps/api/tauri";
import {
  readTextFile,
  readDir,
  removeFile as rf,
  FileEntry,
} from "@tauri-apps/api/fs";
import { save } from "@tauri-apps/api/dialog";
import { Command } from "@tauri-apps/api/shell";
import {
  terminalWrite,
  terminalWriteLine,
  refreshFirmwareList,
} from "./tools/bus";
import { Path } from "./tools/model";
import moment from "moment";
import { notification, Button } from "ant-design-vue";
import { h, ref } from "vue";

import kleur from "kleur";
import { log } from "console";

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
  let result = {} as Path;
  result = { full: data, name: data };
  let historyPathList = JSON.parse(
    localStorage.getItem("pathList") as string
  ) as Path[];
  if (historyPathList.filter((x) => x.full === result.full).length == 0) {
    historyPathList.push(result);
    localStorage.setItem("pathList", JSON.stringify(historyPathList));
  }
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
  let fileNameList = fileList.map((item) => {
    return item.name;
  });
  return fileNameList;
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

let retryCount = 0;

export async function executedCommand(cmd: String[]) {
  const port = localStorage.getItem("port") as string;

  cmd = cmd.filter((x: String) => x != "");
  let command = Command.sidecar("bin/esptool", cmd as string[]);
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
        `A fatal error occurred: Could not open ${port}, the port doesn't exist`
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
}

export async function partitionTableConvert(
  input: string,
  flashSize: string,
  isBin: boolean
) {
  let currentDir = await getCurrentDir();
  if (!isBin) {
    await writeAllText(currentDir + "\\partitions\\temp.csv", input);
  }

  const resultPromise = new Promise((resolve, reject) => {
    let partitionContent = "#Name,Type,SubType,Offset,Size,Flags\n";
    let command = Command.sidecar("bin/gen_esp32part", [
      !isBin ? currentDir + "\\partitions\\temp.csv" : input,
      "1",
      ...(flashSize != "NONE" ? ["--flash-size", flashSize] : []),
      "--out-string",
      "1",
    ]);
    command.on("close", (data) => {
      if (partitionContent.split("\n").length != 2) {
        resolve(partitionContent);
      }
    });
    command.on("error", (error) => terminalWrite(error));
    command.stdout.on("data", async (line) => {
      if (line.charAt(0) != "#") {
        partitionContent += line + "\n";
      }
    });
    command.stderr.on("data", (line) => {
      terminalWrite(
        kleur.bold().blue(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] `)
      );
      terminalWriteLine(line);
    });

    const child = command.spawn();
  });

  const result = await resultPromise;
  return result;
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
