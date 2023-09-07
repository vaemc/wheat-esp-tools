import { Command } from "@tauri-apps/api/shell";
import { write, writeln } from "@/bus/terminal";

import mitt from "mitt";
const emitter = mitt();
export default emitter;

export function execute(name:string,cmd: string[]) {
  cmd = cmd.filter((x: string) => x != "");
  let command = Command.sidecar(`bin/${name}`, cmd as string[]);
  command.on("close", (data) => {
    emitter.emit("close", data);
  });
  command.on("error", (error) => {
    emitter.emit("error", error);
  });
  command.stdout.on("data", (line) => {
    writeln(line);
    emitter.emit("stdout", line);
  });
  command.stderr.on("data", (line) => {
    writeln(line);
    emitter.emit("stderr", line);
  });
  const child = command.spawn();
}
