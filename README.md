# WHEAT ESP TOOLS

方便自己使用

* 功能支持[JSON](/src-tauri/tools.config.json)进行自定义配置✅

# Some Screenshots
![](images/1.png)

自带工具如下，可以参考如下配置进行扩展
``` json
[
  {
    "name": "合并固件",
    "toast": null,
    "cmd": [
      "--chip",
      "${chip}",
      "merge_bin",
      "-o",
      "${appName}",
      "${flashArgs}"
    ],
    "isDrop": true,
    "drop": {
      "value": "mergeBin",
      "isDirectory": true,
      "desc": "选择或者拖拽build目录到此",
      "help": "请在执行idf.pybuild后再使用",
      "regex": "(build)$"
    }
  },
  {
    "name": "烧录",
    "toast": "烧录未合并的固件",
    "cmd": [
      "--chip",
      "${chip}",
      "-p",
      "${port}",
      "-b",
      "1152000",
      "--before=default_reset",
      "--after=hard_reset",
      "write_flash",
      "${flashArgs}"
    ],
    "isDrop": true,
    "drop": {
      "value": "flash",
      "isDirectory": true,
      "desc": "选择或者拖拽build目录到此",
      "help": "请在执行idf.pybuild后再使用",
      "regex": "(build)$"
    }
  },
  {
    "name": "烧录单个",
    "toast": "烧录合并后的固件",
    "cmd": [
      "-p",
      "${port}",
      "-b",
      "1152000",
      "write_flash",
      "0x0",
      "${path}"
    ],
    "isDrop": true,
    "drop": {
      "value": "flashSingle",
      "isDirectory": false,
      "desc": "选择或者拖拽bin文件到此",
      "help": "只支持下载地址为0x0的固件",
      "regex": ".(bin)$"
    }
  },
  {
    "name": "擦除固件",
    "toast": "擦除固件",
    "isDrop": false,
    "cmd": [
      "-p",
      "${port}",
      "erase_flash"
    ]
  },
  {
    "name": "获取flash大小",
    "toast": "获取flash大小",
    "isDrop": false,
    "cmd": [
      "-p",
      "${port}",
      "flash_id"
    ]
  }
]
```


