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
    id: "合并build目录的固件",
    name: "合并build目录的固件",
    description: "请在执行idf.py build后再使用",
    cmd: ["--chip", "${chip}", "merge_bin", "-o", "${appName}", "${flashArgs}"],
  },
  {
    id: "烧录build目录的固件",
    name: "烧录build目录的固件",
    description: "烧录未合并的固件",
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
  },
  {
    id: "烧录地址为0x0的固件",
    name: "烧录地址为0x0的固件",
    description: "烧录合并后的固件",
    cmd: ["-p", "${port}", "-b", "1152000", "write_flash", "0x0", "${path}"],
    file: "3f86778d-142c-44de-9562-a16af05568e0.vue",
  },
  {
    id: "擦除固件",
    name: "擦除固件",
    description: "擦除固件",
    cmd: ["-p", "${port}", "erase_flash"],
    file: "89d2ffc5-b373-43e9-9de3-51ac4b9e0d96.vue",
  },
  {
    id: "获取flash大小",
    name: "获取flash大小",
    description: "获取flash大小",
    cmd: ["-p", "${port}", "flash_id"],
    file: "89081fd0-7f96-4b03-a0df-3925352903a4.vue",
  },
  {
    id: "烧录固件到指定地址",
    name: "烧录固件到指定地址",
  },
  {
    id: "合并自定义地址固件",
    name: "合并自定义地址固件",
  },
];
