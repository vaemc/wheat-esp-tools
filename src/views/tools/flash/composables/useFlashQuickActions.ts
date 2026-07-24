import { join } from "@tauri-apps/api/path";
import type { Ref } from "vue";
import { getCurrentDir, openFileInExplorer } from "@/utils/common";
import { eraseFlash as eraseFlashOp, readFlash } from "@/utils/espflash";
import { usePortStore } from "@/stores/port";
import { nowMs } from "@/utils/datetime";
import { message } from "ant-design-vue";
import { useI18n } from "vue-i18n";

/** 擦除整片 Flash、读取整片 Flash */
export function useFlashQuickActions(baudRate: Ref<string>) {
  const { t } = useI18n();

  function ensurePort(): string | null {
    const port = usePortStore().selectedPort;
    if (!port) {
      message.warning(t("flash.noPort"));
      return null;
    }
    return port;
  }

  function reportError(e: unknown) {
    if (e instanceof Error && e.message === "ESPFLASH_BUSY") {
      message.warning(t("espflash.busy"));
      return;
    }
    message.error(t("flash.flashFailed"));
  }

  async function eraseFlash() {
    const port = ensurePort();
    if (!port) {
      return;
    }
    try {
      await eraseFlashOp(port, baudRate.value);
    } catch (e) {
      reportError(e);
    }
  }

  async function readFlashAll() {
    const port = ensurePort();
    if (!port) {
      return;
    }

    const currentDir = await getCurrentDir();
    const savePath = await join(
      currentDir,
      "firmware",
      `read-${nowMs()}.bin`
    );

    try {
      await readFlash(port, baudRate.value, "0", "ALL", savePath);
      await openFileInExplorer(savePath);
    } catch (e) {
      reportError(e);
    }
  }

  return {
    eraseFlash,
    readFlash: readFlashAll,
  };
}
