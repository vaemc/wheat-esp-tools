import { createI18n } from "vue-i18n";

const messages = {
  zh: {
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
      dropSubtitle:
        "<b>固件名称_烧录地址.bin</b>: 'ESP32_0x222.bin' <br /> <b>ESP-IDF</b>: your_porject/build/flasher_args.json <br />   <b>PlatformIO IDE</b>: your_porject/.pio/build/your_board/idedata.json",
      dialog: {
        selectedChipType: "请选择芯片类型",
        addFirmware: "请添加固件",
        selecOneFirmware: "请最少勾选一个固件",
        inputAddress: "固件地址未填写",
        inputPath: "固件路径未填写",
      },
    },
    partition: {
      offsetCalculation: "偏移计算",
      calculate: "计算",
      csvContent: "CSV内容",
      unlimited: "不限制FLASH大小",
      file: "文件",
      dropTitle: "选择或者拖拽文件到此",
      dropSubtitle: "分区表CSV文件或分区表固件",
      table: "表格",
      text: "文本",
      partitionTableSize: "分区表大小",
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
      flashOption: "烧录选项",
      openTheFolder: "打开文件夹",
      baudRate: "烧录波特率",
    },
    ble: {
      startScanning: "开始扫描",
      stopScanning: "停止扫描",
      reset: "重置",
      filter: "过滤",
      name: "名称",
      advertising: "广播",
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
      dropSubtitle:
        "<b>Filename_Offset.bin</b>: 'ESP32_0x222.bin' <br /> <b>ESP-IDF</b>: your_porject/build/flasher_args.json <br />   <b>PlatformIO IDE</b>: your_porject/.pio/build/your_board/idedata.json",
      dialog: {
        selectedChipType: "Please select a target",
        addFirmware: "Please add firmware",
        selecOneFirmware: "Please select at least one firmware",
        inputAddress: "Firmware offset is not filled in",
        inputPath: "Firmware path is not filled in",
      },
    },
    partition: {
      offsetCalculation: "Offset Calculation",
      calculate: "Calculate",
      csvContent: "CSV content",
      unlimited: "Unlimited",
      file: "File",
      dropTitle: "Select or drag file here",
      dropSubtitle: "Partition table csv file or partition table firmware",
      table: "Table",
      text: "Text",
      partitionTableSize: "Partition table size",
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
      flashOption: "Flash Option",
      openTheFolder: "Open the folder",
      baudRate: "Baud Rate",
    },
    ble: {
      startScanning: "Start Scanning",
      stopScanning: "Stop Scanning",
      reset: "Reset",
      filter: "Filter",
      name: "Name",
      advertising: "Advertising",
    },
  },
};

let language = localStorage.getItem("language");
if (language == null) {
  language = "zh";
}

const i18n = createI18n({
  warnHtmlMessage: false,
  legacy: false,
  globalInjection: true,
  locale: language as "zh" | "en",
  messages,
});

export default i18n;
