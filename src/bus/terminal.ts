import mitt from "mitt";
import type { TerminalLine, TerminalLogLevel } from "@/utils/terminalLog";

type TerminalEvents = {
  writeln: string | TerminalLine;
};

const emitter = mitt<TerminalEvents>();
export default emitter;

/** 写入终端一行；可指定级别以应用 ANSI 配色 */
export function writeln(data: string, level?: TerminalLogLevel) {
  if (level) {
    emitter.emit("writeln", { text: data, level });
  } else {
    emitter.emit("writeln", data);
  }
}

export function writelnLine(line: TerminalLine) {
  emitter.emit("writeln", line);
}
