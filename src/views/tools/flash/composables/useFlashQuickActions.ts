import { getCurrentDir, openFileInExplorer } from "@/utils/common";
import { runEsptool, runEsptoolWithStdout } from "@/utils/esptoolCli";
import { usePortStore } from "@/stores/port";
import moment from "moment";
import { message } from "ant-design-vue";
import { useI18n } from "vue-i18n";

/** 擦除整片 Flash、读取整片 Flash */
export function useFlashQuickActions() {
  const { t } = useI18n();

  function ensurePort(): string | null {
    const port = usePortStore().selectedPort;
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

    await runEsptoolWithStdout(
      ["-p", port, "-b", "460800", "read-flash", "0", "ALL", savePath],
      (line) => {
        if (line.includes("Hard resetting via RTS pin...")) {
          openFileInExplorer(savePath);
        }
      }
    );
  }

  return {
    eraseFlash,
    readFlash,
  };
}
