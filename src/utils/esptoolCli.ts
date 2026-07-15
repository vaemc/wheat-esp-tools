import { execute, type ExecuteOptions } from "@/utils/cli";
import { withEsptoolLock } from "@/utils/esptoolLock";

function wrapEsptoolError(cause: unknown): Error {
  const wrapped = new Error("ESPTOOL_FAILED");
  (wrapped as unknown as { cause?: unknown }).cause = cause;
  return wrapped;
}

/**
 * 执行 esptool 并等待该次进程结束。
 * 全应用互斥：keep-alive 多页也不能并行抢串口。
 * 非 0 退出码会 reject（write-flash 上层可按日志启发式吞掉假错误）。
 */
async function runEsptoolSession(
  args: string[],
  opts: ExecuteOptions = {}
): Promise<void> {
  return withEsptoolLock(async () => {
    try {
      const close = await execute("esptool", args, opts);
      if (close.code != null && close.code !== 0) {
        throw wrapEsptoolError(close);
      }
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "ESPTOOL_FAILED" || err.message === "ESPTOOL_BUSY")
      ) {
        throw err;
      }
      throw wrapEsptoolError(err);
    }
  });
}

/** 执行 esptool 并等待进程结束 */
export function runEsptool(args: string[]): Promise<void> {
  return runEsptoolSession(args);
}

/** 执行 esptool 并在 stdout 回调中处理输出 */
export function runEsptoolWithStdout(
  args: string[],
  onStdout: (line: string) => void
): Promise<void> {
  return runEsptoolSession(args, { onStdout });
}

/** 执行 esptool 并同时回调 stdout / stderr */
export function runEsptoolWithIO(
  args: string[],
  onStdout: (line: string) => void,
  onStderr: (line: string) => void
): Promise<void> {
  return runEsptoolSession(args, { onStdout, onStderr });
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
