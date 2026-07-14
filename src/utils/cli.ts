import { Command } from "@tauri-apps/plugin-shell";
import { writeln } from "@/bus/terminal";

import mitt from "mitt";

type CliEvents = {
  stdout: string;
  stderr: string;
  close: unknown;
  error: unknown;
};

const emitter = mitt<CliEvents>();
export default emitter;

/** Tauri 2 shell 的 data 事件会保留行尾换行；xterm.writeln 还会再追加一次 */
function normalizeCliLine(line: string) {
  return line.replace(/\r?\n$/, "").replace(/\r$/, "");
}

export function execute(name: string, cmd: string[]) {
  cmd = cmd.filter((x: string) => x != "");
  let command = Command.sidecar(`bin/${name}`, cmd as string[]);
  command.on("close", (data) => {
    emitter.emit("close", data);
  });
  command.on("error", (error) => {
    emitter.emit("error", error);
  });
  command.stdout.on("data", (line) => {
    const text = normalizeCliLine(line);
    writeln(text);
    emitter.emit("stdout", text);
  });
  command.stderr.on("data", (line) => {
    const text = normalizeCliLine(line);
    writeln(text);
    emitter.emit("stderr", text);
  });
  command.spawn();
}
