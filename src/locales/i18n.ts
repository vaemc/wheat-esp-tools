import { createI18n } from "vue-i18n";

const messages = {
  cn: {
    menu: {
      toolList: "工具列表",
      home: "首页",
      general: "常规",
      partitionTable: "分区表",
      flash: "烧录或合并固件",
      firmware: "固件管理",
    },
    general: {
      eraseFlash: "擦除Flash",
      flashSize: "获取Flash大小",
      readFirmware: "读取固件",
    },
    firmware: {
      path: "历史路径",
      firmware: "固件",
      flash: "烧录",
      open: "打开",
      remove: "删除",
      eraseFlash: "擦除",
      eraseFlashInfo: "烧录前先擦除Flash",
      openInExplorer: "在资源管理器中打开",
      burnOption: "烧录选项",
    },
    flash: {
      baudRate: "烧录波特率",
      merge: "合并",
      mergeInfo: "仅合并固件时需要选择",
      chipType: "芯片类型",
      flash: "烧录",
      open: "打开",
      remove: "删除",
      eraseFlash: "擦除固件",
      eraseFlashInfo: "烧录前先擦除Flash",
      path: "路径",
      address: "烧录地址",
      size: "大小",
      action: "操作",
      dropTitle: "选择或者拖拽多个bin文件到此",
      dropSubtitle: "固件名称_烧录地址.bin: 'ESP32_0x222.bin' <br /> ESP-IDF: your_porject/build/flasher_args.json <br />   PlatformIO IDE: your_porject/.pio/build/your_board/idedata.json",
      dialog:{
        selectedChipType:"请选择芯片类型",
        addFirmware:"请添加固件",
        selecOneFirmware:"请最少勾选一个固件",
        inputAddress:"固件地址未填写",
        inputPath:"固件路径未填写"
      }
    },
  },
  en: {
    menu: {
      toolList: "Tool List",
      home: "Home",
      general: "General",
      partitionTable: "Partition Table",
      flash: "Flash & Merge",
      firmware: "Firmware",
    },
    general: {
      eraseFlash: "Erase Flash",
      flashSize: "Flash Size",
      readFirmware: "Read Firmware",
    },
    firmware: {
      path: "History Path",
      firmware: "Firmware",
      flash: "Flash",
      open: "Open",
      remove: "Remove",
      eraseFlash: "Erase Flash",
      eraseFlashInfo: "Erase before burning",
      openInExplorer: "Open in Explorer",
      burnOption: "Burn Option",
    },
    flash: {
      baudRate: "Baud Rate",
      merge: "Merge",
      mergeInfo: "Select only when merging",
      chipType: "Target",
      flash: "Flash",
      open: "Open",
      remove: "Remove",
      eraseFlash: "Erase Flash",
      eraseFlashInfo: "Erase before burning",
      path: "Path",
      address: "Offset",
      size: "Size",
      action: "Action",
      dropTitle: "Select or drag multiple firmware files here",
      dropSubtitle: "Filename_Offset.bin: 'ESP32_0x222.bin' <br /> ESP-IDF: your_porject/build/flasher_args.json <br />   PlatformIO IDE: your_porject/.pio/build/your_board/idedata.json",
      dialog:{
        selectedChipType:"Please select a target",
        addFirmware:"Please add firmware",
        selecOneFirmware:"Please select at least one firmware",
        inputAddress:"Firmware offset is not filled in",
        inputPath:"Firmware path is not filled in"
      }
    },
  },
};
const i18n = createI18n({
  warnHtmlMessage: false,
  legacy: false,
  globalInjection: true,
  locale: "en",
  messages,
});

export default i18n;
