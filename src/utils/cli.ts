import { Command } from "@tauri-apps/plugin-shell";
import { writeln } from "@/bus/terminal";

/** Tauri 2 shell 的 data 事件会保留行尾换行；xterm.writeln 还会再追加一次 */
function normalizeCliLine(line: string) {
  return line.replace(/\r?\n$/, "").replace(/\r$/, "");
}

export type ExecuteClose = {
  code: number | null;
  signal: number | null;
};

export interface ExecuteOptions {
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
}

/**
 * 启动 sidecar 并等待该进程结束（每进程独立 Promise，互不干扰）。
 */
export function execute(
  name: string,
  cmd: string[],
  opts: ExecuteOptions = {}
): Promise<ExecuteClose> {
  const args = cmd.filter((x: string) => x !== "");
  const command = Command.sidecar(`bin/${name}`, args);

  return new Promise((resolve, reject) => {
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      fn();
    };

    command.on("close", (data) => {
      settle(() =>
        resolve({
          code: data.code ?? null,
          signal: data.signal ?? null,
        })
      );
    });
    command.on("error", (error) => {
      settle(() => reject(error));
    });
    command.stdout.on("data", (line) => {
      const text = normalizeCliLine(line);
      writeln(text);
      opts.onStdout?.(text);
    });
    command.stderr.on("data", (line) => {
      const text = normalizeCliLine(line);
      writeln(text);
      opts.onStderr?.(text);
    });

    void command.spawn().catch((error) => {
      settle(() => reject(error));
    });
  });
}
