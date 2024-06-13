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
      eraseFlashInfo: "烧录前先擦除",
      openInExplorer: "在资源管理器中打开",
      burnOption: "烧录选项",
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
  },
};
const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: "en",
  messages,
});

export default i18n;
