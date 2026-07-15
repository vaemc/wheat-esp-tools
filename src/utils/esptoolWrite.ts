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
 * esptool write-flash 的终态成功标志（故意不用 "Wrote N bytes"：
 * 多段烧录时每段都会打印，中途失败仍会误判成功）。
 *
 * Tauri Shell 在 sidecar 结束时偶发 spurious error（hard-reset 端口抖动 /
 * 非 UTF-8 行），所以在看到终态成功信号后可忽略底层 processError。
 */
const WRITE_SUCCESS_PATTERNS = [
  /hash of data verified/i,
  /leaving\.\.\./i,
  /hard resetting via rts pin/i,
];

/** esptool 输出里出现的明确失败标志（少量、保守，避免误杀） */
const WRITE_FAILURE_PATTERNS = [
  /a fatal error occurred/i,
  /failed to connect to/i,
  /could not open port/i,
  /access is denied/i,
  /error:\s+the chip stop responding/i,
];

/** 执行 esptool write-flash，等待完成 */
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
    before = "default-reset",
    after = "hard-reset",
  } = options;

  const args: string[] = [
    "-p",
    port,
    "-b",
    baud,
    `--before=${before}`,
    `--after=${after}`,
    "write-flash",
    "--flash-mode",
    flashMode,
  ];

  // 官方 CLI：选项在 address/filename 对之前
  if (eraseAll) {
    args.push("--erase-all");
  }

  for (const item of items) {
    args.push(item.offset, item.path);
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
    await runEsptoolWithIO(args, inspect, inspect);
  } catch (err) {
    processError = err;
  }

  if (sawFailure) {
    const wrap = new Error("ESPTOOL_FAILED");
    if (processError) {
      (wrap as unknown as { cause?: unknown }).cause = processError;
    }
    throw wrap;
  }

  if (sawSuccess) {
    if (processError) {
      console.warn(
        "[esptoolWrite] write-flash 已识别终态成功标志，忽略底层非致命错误：",
        processError
      );
    }
    return;
  }

  if (processError) {
    throw processError;
  }

  // 进程正常退出(code=0)且无失败关键字：视为成功（部分版本不打 Leaving）
}
