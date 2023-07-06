export const mergeCustomFirmwareToolID = "111";
export const moreToolID = "222";

export const chipTypeList = [
  "ESP32",
  "ESP32C2",
  "ESP32C3",
  "ESP32C6",
  "ESP32S2",
  "ESP32S3",
  "ESP32H2",
  "ESP8266",
];

export const toolListConfig = [
  {
    name: "合并build目录的固件",
    toast: null,
    cmd: ["--chip", "${chip}", "merge_bin", "-o", "${appName}", "${flashArgs}"],
    isDrop: true,
    drop: {
      value: "mergeBin",
      isDirectory: true,
      desc: "选择或者拖拽build目录到此",
      help: "请在执行idf.py build后再使用",
      regex: "(build)$",
    },
  },
  {
    name: "烧录build目录的固件",
    toast: "烧录未合并的固件",
    cmd: [
      "--chip",
      "${chip}",
      "-p",
      "${port}",
      "-b",
      "1152000",
      "--before=default_reset",
      "--after=hard_reset",
      "write_flash",
      "${flashArgs}",
    ],
    isDrop: true,
    drop: {
      value: "flash",
      isDirectory: true,
      desc: "选择或者拖拽build目录到此",
      help: "请在执行idf.py build后再使用",
      regex: "(build)$",
    },
  },
  {
    name: "烧录地址为0x0的固件",
    toast: "烧录合并后的固件",
    cmd: ["-p", "${port}", "-b", "1152000", "write_flash", "0x0", "${path}"],
    isDrop: true,
    drop: {
      value: "flashSingle",
      isDirectory: false,
      desc: "选择或者拖拽bin文件到此",
      help: "烧录地址为0x0的固件",
      regex: ".(bin)$",
    },
  },
  {
    name: "擦除固件",
    toast: "擦除固件",
    isDrop: false,
    cmd: ["-p", "${port}", "erase_flash"],
  },
  {
    name: "获取flash大小",
    toast: "获取flash大小",
    isDrop: false,
    cmd: ["-p", "${port}", "flash_id"],
  },
];
