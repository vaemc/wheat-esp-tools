import kleur from "kleur";
import { formatDateTime } from "@/utils/datetime";

/** 强制启用 ANSI（浏览器 / xterm 环境） */
kleur.enabled = true;

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
      return kleur.bold().green(tag);
    case "warn":
      return kleur.bold().yellow(tag);
    case "error":
      return kleur.bold().red(tag);
    case "step":
      return kleur.bold().cyan(tag);
    case "dim":
      return kleur.dim(tag);
    case "info":
    default:
      return kleur.bold().blue(tag);
  }
}

function paintBody(text: string, level: TerminalLogLevel): string {
  switch (level) {
    case "success":
      return kleur.green(text);
    case "warn":
      return kleur.yellow(text);
    case "error":
      return kleur.red(text);
    case "step":
      return kleur.cyan(text);
    case "dim":
      return kleur.dim(text);
    case "info":
    default:
      return kleur.white(text);
  }
}

/** 将一行终端日志格式化为带 ANSI 颜色的字符串 */
export function formatTerminalLine(input: string | TerminalLine): string {
  const text = typeof input === "string" ? input : input.text;
  const level: TerminalLogLevel =
    typeof input === "string" ? "info" : (input.level ?? "info");

  const time = kleur.dim(formatDateTime());
  const bracketL = kleur.dim("[");
  const bracketR = kleur.dim("]");
  const sep = kleur.dim("│");

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
    case "segmentInfo":
    case "chipInfo":
    case "writeInit":
    case "writeVerifying":
    case "targetChip":
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
