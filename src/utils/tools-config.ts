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
    id: "508bde81b24d4c459835fb6c80eb87cc",
    name: "合并build目录的固件",
    description: "请在执行idf.py build后再使用",
    cmd: ["--chip", "${chip}", "merge_bin", "-o", "${appName}", "${flashArgs}"],
  },
  {
    id: "cb60777c2c2d4a0683372742ef818bd6",
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
    id: "648f481016394ffcaccfa33d30b2ea04",
    name: "烧录地址为0x0的固件",
    description: "烧录合并后的固件",
    cmd: ["-p", "${port}", "-b", "1152000", "write_flash", "0x0", "${path}"],
    file: "3f86778d-142c-44de-9562-a16af05568e0.vue",
  },
  {
    id: "9b8341dcf4d54e4eade08632381a1ce2",
    name: "擦除固件",
    description: "擦除固件",
    cmd: ["-p", "${port}", "erase_flash"],
    file: "89d2ffc5-b373-43e9-9de3-51ac4b9e0d96.vue",
  },
  {
    id: "2a4fb7e0ee60448a9fc392a740b369b0",
    name: "获取flash大小",
    description: "获取flash大小",
    cmd: ["-p", "${port}", "flash_id"],
    file: "89081fd0-7f96-4b03-a0df-3925352903a4.vue",
  },
];
