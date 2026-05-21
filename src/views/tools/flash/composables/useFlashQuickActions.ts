import cli, { execute } from "@/utils/cli";
import { getCurrentDir, openFileInExplorer } from "@/utils/common";
import moment from "moment";
import { message } from "ant-design-vue";
import { useI18n } from "vue-i18n";

function runEsptool(cmd: string[]): Promise<void> {
  return new Promise((resolve) => {
    const onClose = () => {
      cli.off("close", onClose);
      cli.all.clear();
      resolve();
    };
    cli.on("close", onClose);
    execute("esptool", cmd);
  });
}

/** 擦除整片 Flash、读取整片 Flash */
export function useFlashQuickActions() {
  const { t } = useI18n();

  function ensurePort(): string | null {
    const port = localStorage.getItem("port");
    if (!port) {
      message.warning(t("flash.noPort"));
      return null;
    }
    return port;
  }

  async function eraseFlash() {
    const port = ensurePort();
    if (!port) {
      return;
    }
    await runEsptool(["-p", port, "-b", "115200", "erase-flash"]);
  }

  async function readFlash() {
    const port = ensurePort();
    if (!port) {
      return;
    }

    const currentDir = await getCurrentDir();
    const savePath = `${currentDir}\\firmware\\read-${moment().valueOf()}.bin`;

    execute("esptool", [
      "-p",
      port,
      "-b",
      "460800",
      "read-flash",
      "0",
      "ALL",
      savePath,
    ]);

    await new Promise<void>((resolve) => {
      const onStdout = (data: unknown) => {
        if (String(data).includes("Hard resetting via RTS pin...")) {
          openFileInExplorer(savePath);
        }
      };
      const onClose = () => {
        cli.off("stdout", onStdout);
        cli.off("close", onClose);
        cli.all.clear();
        resolve();
      };
      cli.on("stdout", onStdout);
      cli.on("close", onClose);
    });
  }

  return {
    eraseFlash,
    readFlash,
  };
}
