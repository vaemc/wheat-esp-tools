import cli, { execute } from "@/utils/cli";

/** 执行 esptool read-flash 并等待结束 */
export async function runEsptoolReadFlash(
  port: string,
  baud: string,
  offset: string,
  size: string,
  savePath: string
): Promise<void> {
  execute("esptool", ["-p", port, "-b", baud, "read-flash", offset, size, savePath]);

  await new Promise<void>((resolve, reject) => {
    const onClose = () => {
      cli.all.clear();
      resolve();
    };
    const onError = () => {
      cli.all.clear();
      reject(new Error("READ_FAILED"));
    };
    cli.on("close", onClose);
    cli.on("error", onError);
  });
}
