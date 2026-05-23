import cli, { execute } from "@/utils/cli";

function listenEsptool(
  onStdout?: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const onStdoutLine = (line: string) => {
      onStdout?.(line);
    };
    const onClose = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("ESPTOOL_FAILED"));
    };
    const cleanup = () => {
      if (onStdout) {
        cli.off("stdout", onStdoutLine);
      }
      cli.off("close", onClose);
      cli.off("error", onError);
      cli.all.clear();
    };

    if (onStdout) {
      cli.on("stdout", onStdoutLine);
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
  return listenEsptool(onStdout);
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
