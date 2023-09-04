import { Option } from "./model";

export const config = [
  {
    type: "custom",
    fileName: "",
    title: "选择或者拖拽多个bin文件到此",
    subtitle:
      "工具可以自动解析结尾使用下划线加烧录地址的固件,如 'ESP32_0x222.bin'",
  },
  {
    type: "flasher_args.json",
    fileName: "flasher_args.json",
    title: "flasher_args.json",
    subtitle: "将flasher_args.json文件拖拽到此",
  },
] as Option[];
