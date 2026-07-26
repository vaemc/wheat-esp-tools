import type { Ref } from "vue";
import { openFileInExplorer } from "@/utils/common";
import {
  eraseFlash as eraseFlashOp,
  readFlash,
  reportEspflashError,
} from "@/utils/espflash";
import { usePortStore } from "@/stores/port";
import { nowMs } from "@/utils/datetime";
import { joinTempWorkDir } from "@/utils/tempWorkDir";
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

  async function eraseFlash() {
    const port = ensurePort();
    if (!port) {
      return;
    }
    try {
      await eraseFlashOp(port, baudRate.value);
    } catch (e) {
      reportEspflashError(e, "flash.flashFailed");
    }
  }

  async function readFlashAll() {
    const port = ensurePort();
    if (!port) {
      return;
    }

    const savePath = await joinTempWorkDir(
      "firmware",
      `read-${nowMs()}.bin`
    );

    try {
      await readFlash(port, baudRate.value, "0", "ALL", savePath);
      await openFileInExplorer(savePath);
    } catch (e) {
      reportEspflashError(e, "flash.flashFailed");
    }
  }

  return {
    eraseFlash,
    readFlash: readFlashAll,
  };
}
