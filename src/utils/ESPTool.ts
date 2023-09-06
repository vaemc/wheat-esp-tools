
import { Command } from "@tauri-apps/api/shell";



export async function writeFlash(cmd: string[]) {
  const resultPromise = new Promise((resolve, reject) => {
    cmd = cmd.filter((x: String) => x != "");
    let command = Command.sidecar("bin/esptool", cmd as string[]);
    command.on("close", (data) => {});
    command.on("error", (error) => {});
    command.stdout.on("data", (line) => {
      console.log(line);
    });
    command.stderr.on("data", (line) => {
      console.error(line);
    });
    const child = command.spawn();
  });

  const result = await resultPromise;
  return result;
}
