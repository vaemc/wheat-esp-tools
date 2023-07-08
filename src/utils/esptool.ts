import { Command } from "@tauri-apps/api/shell";
import { exists, readTextFile } from "@tauri-apps/api/fs";
import { terminalWrite, terminalWriteLine, refreshFirmwareList } from "./bus";
import { message } from "ant-design-vue";
import { portStore } from "./store";
import moment from "moment";
import { balanced } from "./balanced-match";
import { getCurrentDir, isEspToolExists, openFileInExplorer } from "./common";
import { notification, Button } from "ant-design-vue";
import { h } from "vue";

import kleur from "kleur";

const currentDir = await getCurrentDir();



export async function generateCmd(data: string[], path = "") {
  const port = portStore().port;

  let cmd = data;
  if (cmd.find((x: string) => x === "${port}") != null) {
    if (port === "") {
      message.warning("请选择端口！");
      return;
    }
  }
  let isIncludeFlashArgs =
    cmd.find((x: string) => x === "${flashArgs}") != null;
  let appInfo = {} as any;
  if (isIncludeFlashArgs) {
    appInfo = await getFlasherArgs(path);
  }
  cmd = cmd.map((item: string) => {
    switch (item) {
      case "${chip}":
        return appInfo.chip;
      case "${appName}":
        return `${currentDir}\\firmware\\${appInfo.appName}.bin`;
      case "${port}":
        return port;
      case "${path}":
        return path;
    }
    return item;
  });
  if (isIncludeFlashArgs) {
    cmd.splice(cmd.indexOf("${flashArgs}"), 0, ...appInfo.flashArgs);
    cmd = cmd.filter((x: string) => x != "${flashArgs}");
  }

  return cmd;
}

export async function getFlasherArgs(path: string) {
  let flasherArgs = JSON.parse(
    await readTextFile(`${path}\\flasher_args.json`)
  );
  const flattenedList = [
    ...(Object.keys(flasherArgs.flash_files) as string[]).map((item) => {
      console.log(item);
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

export async function runCmd(cmd: string[]) {
  let result = await isEspToolExists();
  if (!result) {
    notification.open({
      message: "未检测到esptool工具",
      description: "请将esptool工具放在软件根目录esptool文件夹！",
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

  if (cmd.find((x: string) => x === "merge_bin") != null) {
    openFileInExplorer(currentDir + "\\firmware");
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

// function decimalToHexString(number: number) {
//   if (number < 0) {
//     number = 0xffffffff + number + 1;
//   }

//   return number.toString(16).toUpperCase();
// }

// export async function saveFirmware(cmd: string[], savePath: string) {
//   const port = portStore().port;

//   let result = await isEspToolExists();
//   if (!result) {
//     notification.open({
//       message: "未检测到esptool工具",
//       description: "请将esptool工具放在软件根目录esptool文件夹！",
//       btn: () =>
//         h(
//           Button,
//           {
//             type: "primary",
//             size: "small",
//             onClick: () => {
//               openFileInExplorer(currentDir + "\\esptool");
//             },
//           },
//           {
//             default: () => "打开文件夹",
//           }
//         ),
//     });

//     return;
//   }

//   if (cmd.find((x) => x === "merge_bin") != null) {
//     openFileInExplorer(currentDir + "\\firmware");
//   }

//   cmd = cmd.filter((x) => x != "");
//   const command = new Command("esptool", cmd);
//   command.on("close", (data) => {});
//   command.on("error", (error) => terminalWrite(error));
//   command.stdout.on("data", (line) => {
//     terminalWrite(line);
//     let flashSize = balanced("Detected flash size: ", "MB", line)?.body;
//     if (flashSize != null) {
//       console.log(flashSize);

//       let cmd = [
//         "-p",
//         port,
//         "-b",
//         "460800",
//         "read_flash",
//         "0",
//         `0x${flashSize}00000`,
//         savePath,
//       ];

//       runCmd(cmd);
//     }
//   });
//   command.stderr.on("data", (line) => terminalWrite(line));
//   const child = await command.spawn();

//   // await new Promise((r) => setTimeout(r, 2500));
//   // await refreshFirmwareList();
//   //console.log("pid:", child.pid);
// }
