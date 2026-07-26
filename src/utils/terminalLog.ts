import { formatDateTime } from "@/utils/datetime";

/** xterm 可用的 ANSI 转义（不依赖第三方着色库） */
const enum Ansi {
  Reset = "\x1b[0m",
  Bold = "\x1b[1m",
  Dim = "\x1b[2m",
  Red = "\x1b[31m",
  Green = "\x1b[32m",
  Yellow = "\x1b[33m",
  Blue = "\x1b[34m",
  Cyan = "\x1b[36m",
  White = "\x1b[37m",
}

function paint(code: Ansi, text: string, bold = false): string {
  return `${bold ? Ansi.Bold : ""}${code}${text}${Ansi.Reset}`;
}

function dim(text: string): string {
  return paint(Ansi.Dim, text);
}

export type TerminalLogLevel =
  | "info"
  | "success"
  | "warn"
  | "error"
  | "step"
  | "dim";

export interface TerminalLine {
  text: string;
  level?: TerminalLogLevel;
}

const LEVEL_TAG: Record<TerminalLogLevel, string> = {
  info: "INFO",
  success: " OK ",
  warn: "WARN",
  error: " ERR",
  step: "STEP",
  dim: " ·  ",
};

function paintTag(level: TerminalLogLevel): string {
  const tag = LEVEL_TAG[level];
  switch (level) {
    case "success":
      return paint(Ansi.Green, tag, true);
    case "warn":
      return paint(Ansi.Yellow, tag, true);
    case "error":
      return paint(Ansi.Red, tag, true);
    case "step":
      return paint(Ansi.Cyan, tag, true);
    case "dim":
      return dim(tag);
    case "info":
    default:
      return paint(Ansi.Blue, tag, true);
  }
}

function paintBody(text: string, level: TerminalLogLevel): string {
  switch (level) {
    case "success":
      return paint(Ansi.Green, text);
    case "warn":
      return paint(Ansi.Yellow, text);
    case "error":
      return paint(Ansi.Red, text);
    case "step":
      return paint(Ansi.Cyan, text);
    case "dim":
      return dim(text);
    case "info":
    default:
      return paint(Ansi.White, text);
  }
}

/** 将一行终端日志格式化为带 ANSI 颜色的字符串 */
export function formatTerminalLine(input: string | TerminalLine): string {
  const text = typeof input === "string" ? input : input.text;
  const level: TerminalLogLevel =
    typeof input === "string" ? "info" : (input.level ?? "info");

  const time = dim(formatDateTime());
  const bracketL = dim("[");
  const bracketR = dim("]");
  const sep = dim("│");

  return `${bracketL}${time}${bracketR} ${sep} ${paintTag(level)} ${paintBody(
    text,
    level
  )}`;
}

/** espflash messageKey → 终端级别 */
export function espflashLogLevel(messageKey: string): TerminalLogLevel {
  switch (messageKey) {
    case "writeDone":
    case "readDone":
    case "eraseAllDone":
    case "eraseRegionDone":
    case "mergeDone":
    case "writeSegmentDone":
    case "deviceInfoDone":
      return "success";

    case "failed":
      return "error";

    case "securityUnavailable":
    case "eraseAllRunning":
    case "eraseRegionRunning":
    case "readBaudCapped":
    case "readRetryBaud":
      return "warn";

    case "writeSkipped":
    case "preparing":
      return "dim";

    case "openPort":
    case "connectingStub":
    case "connectingRom":
    case "segmentInfo":
    case "chipInfo":
    case "writeInit":
    case "writeVerifying":
    case "mergeReading":
    case "mergeAlloc":
    case "mergeSegment":
    case "mergeWriting":
    case "detectFlashSize":
    case "readRunning":
    case "readProgress":
    case "deviceInfoQuery":
    case "deviceInfoSecurity":
      return "step";

    case "writeStarting":
    case "readStarting":
    case "eraseStarting":
    case "eraseRegionStarting":
    case "deviceInfoStarting":
    case "mergeStarting":
    case "writeProgress":
    default:
      return "info";
  }
}
