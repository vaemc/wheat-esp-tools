import { runEsptoolWithIO } from "@/utils/esptoolCli";

export interface FlashItem {
  /** 0x9000 / 0x10000 等 */
  offset: string;
  /** 本地 .bin 文件绝对路径 */
  path: string;
}

export interface WriteFlashOptions {
  /** SPI flash 模式，默认 dio */
  flashMode?: string;
  /** 是否在写入前 erase-all（整片擦除，慎用） */
  eraseAll?: boolean;
  /** 复位策略 */
  before?: string;
  after?: string;
}

/**
 * esptool write_flash 的"成功标志"。
 *
 * Tauri Shell 在 sidecar 进程结束时偶发会先于 / 同步于 close 事件 emit error
 * （比如 hard_reset 触发设备复位时端口抖动、stdout/stderr 中带非 UTF-8 字节
 * 导致 Tauri 的 read_line 解码失败），让 listenEsptool reject。
 * 但此时数据其实已经成功写入。
 *
 * 真实的"写完了"信号其实在 esptool 的 stdout / stderr 里非常稳定，任一出现都
 * 意味着写入流程跑完了：
 *   - "Hash of data verified."         —— write_flash 默认开启 verify，写完必打印
 *   - "Leaving..."                     —— esptool 进入正常退出流程
 *   - "Hard resetting via RTS pin..."  —— 进入复位阶段
 *   - "Wrote ... bytes ... at"         —— 该地址写入完成
 */
const WRITE_SUCCESS_PATTERNS = [
  /hash of data verified/i,
  /leaving\.\.\./i,
  /hard resetting via rts pin/i,
  /wrote\s+\d+\s+bytes/i,
];

/** esptool 输出里出现的明确失败标志（少量、保守，避免误杀） */
const WRITE_FAILURE_PATTERNS = [
  /a fatal error occurred/i,
  /failed to connect to/i,
  /could not open port/i,
  /access is denied/i,
  /error:\s+the chip stop responding/i,
];

/** 执行 esptool write_flash，等待完成 */
export async function runEsptoolWriteFlash(
  port: string,
  baud: string,
  items: FlashItem[],
  options: WriteFlashOptions = {}
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  const {
    flashMode = "dio",
    eraseAll = false,
    before = "default_reset",
    after = "hard_reset",
  } = options;

  const args: string[] = [
    "-p",
    port,
    "-b",
    baud,
    `--before=${before}`,
    `--after=${after}`,
    "write_flash",
    "--flash_mode",
    flashMode,
  ];

  for (const item of items) {
    args.push(item.offset, item.path);
  }
  if (eraseAll) {
    args.push("--erase-all");
  }

  let sawSuccess = false;
  let sawFailure = false;
  let processError: unknown;

  const inspect = (line: string) => {
    if (!sawSuccess && WRITE_SUCCESS_PATTERNS.some((re) => re.test(line))) {
      sawSuccess = true;
    }
    if (!sawFailure && WRITE_FAILURE_PATTERNS.some((re) => re.test(line))) {
      sawFailure = true;
    }
  };

  try {
    // 同时扫描 stdout 和 stderr：
    // 不同 esptool 版本 / 不同子命令把成功消息打到不同流上，stderr 里也可能藏着
    // "Hard resetting via RTS pin..."。
    await runEsptoolWithIO(args, inspect, inspect);
  } catch (err) {
    // listenEsptool 在收到 close/error 事件时 resolve/reject；
    // 不立即透出，先看输出里是否已经出现了成功标志。
    processError = err;
  }

  // 1. 输出里明确包含 esptool 致命错误关键字 → 真正失败
  if (sawFailure) {
    const wrap = new Error("ESPTOOL_FAILED");
    if (processError) {
      (wrap as unknown as { cause?: unknown }).cause = processError;
    }
    throw wrap;
  }
  // 2. 输出里出现过任一成功标志（写入流程已完整跑完）→ 视为成功，
  //    吃掉底层 close/error 竞态以及 utf-8 解码失败导致的 spurious error
  if (sawSuccess) {
    if (processError) {
      // 写完已成功，但底层抛了非致命的错；只在 console 里留个痕迹方便排查
      console.warn(
        "[esptoolWrite] write_flash 已识别成功标志，忽略底层非致命错误：",
        processError
      );
    }
    return;
  }
  // 3. 没看到任何明确信号，进程层面又抛了错 → 真正失败（spawn 失败 / 启动异常等）
  if (processError) {
    throw processError;
  }
}
