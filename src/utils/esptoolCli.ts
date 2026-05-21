import cli, { execute } from "@/utils/cli";

/** 执行 esptool 子命令并收集全部输出 */
export function runEsptoolCollect(
  port: string,
  baud: string,
  subcommand: string,
  extraArgs: string[] = []
): Promise<string> {
  execute("esptool", ["-p", port, "-b", baud, subcommand, ...extraArgs]);

  const lines: string[] = [];

  return new Promise((resolve, reject) => {
    const onStdout = (line: string) => {
      lines.push(line);
    };
    const onStderr = (line: string) => {
      lines.push(line);
    };
    const onClose = () => {
      cleanup();
      resolve(lines.join("\n"));
    };
    const onError = () => {
      cleanup();
      reject(new Error("ESPTOOL_FAILED"));
    };

    const cleanup = () => {
      cli.off("stdout", onStdout);
      cli.off("stderr", onStderr);
      cli.off("close", onClose);
      cli.off("error", onError);
    };

    cli.on("stdout", onStdout);
    cli.on("stderr", onStderr);
    cli.on("close", onClose);
    cli.on("error", onError);
  });
}
