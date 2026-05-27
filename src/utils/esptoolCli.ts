import cli, { execute } from "@/utils/cli";

interface ListenOptions {
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
}

function listenEsptool(opts: ListenOptions = {}): Promise<void> {
  const { onStdout, onStderr } = opts;
  return new Promise((resolve, reject) => {
    const onStdoutLine = (line: string) => {
      onStdout?.(line);
    };
    const onStderrLine = (line: string) => {
      onStderr?.(line);
    };
    const onClose = () => {
      cleanup();
      resolve();
    };
    const onError = (err: unknown) => {
      cleanup();
      // 把底层错误信息一起带出来，方便上层（runEsptoolWriteFlash）做语义判定
      const wrapped = new Error("ESPTOOL_FAILED");
      // 附加原始 error，方便排查
      (wrapped as unknown as { cause?: unknown }).cause = err;
      reject(wrapped);
    };
    const cleanup = () => {
      if (onStdout) {
        cli.off("stdout", onStdoutLine);
      }
      if (onStderr) {
        cli.off("stderr", onStderrLine);
      }
      cli.off("close", onClose);
      cli.off("error", onError);
      cli.all.clear();
    };

    if (onStdout) {
      cli.on("stdout", onStdoutLine);
    }
    if (onStderr) {
      cli.on("stderr", onStderrLine);
    }
    cli.on("close", onClose);
    cli.on("error", onError);
  });
}

/** 执行 esptool 并等待进程结束 */
export function runEsptool(args: string[]): Promise<void> {
  execute("esptool", args);
  return listenEsptool();
}

/** 执行 esptool 并在 stdout 回调中处理输出 */
export function runEsptoolWithStdout(
  args: string[],
  onStdout: (line: string) => void
): Promise<void> {
  execute("esptool", args);
  return listenEsptool({ onStdout });
}

/** 执行 esptool 并同时回调 stdout / stderr（任意流均会触发对应回调） */
export function runEsptoolWithIO(
  args: string[],
  onStdout: (line: string) => void,
  onStderr: (line: string) => void
): Promise<void> {
  execute("esptool", args);
  return listenEsptool({ onStdout, onStderr });
}

/** 执行 esptool 子命令并收集全部输出 */
export function runEsptoolCollect(
  port: string,
  baud: string,
  subcommand: string,
  extraArgs: string[] = []
): Promise<string> {
  const lines: string[] = [];

  return runEsptoolWithStdout(
    ["-p", port, "-b", baud, subcommand, ...extraArgs],
    (line) => {
      lines.push(line);
    }
  ).then(() => lines.join("\n"));
}
