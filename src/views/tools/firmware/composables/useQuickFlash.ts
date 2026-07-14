import { runEsptool } from "@/utils/esptoolCli";
import { usePortStore } from "@/stores/port";
import type { useFlashOptions } from "@/composables/useFlashOptions";

type FlashOptions = Pick<
  ReturnType<typeof useFlashOptions>,
  "baudRate" | "spiMode" | "eraseBeforeFlash"
>;

export function useQuickFlash(options: FlashOptions) {
  async function flashFirmware(path: string) {
    const port = usePortStore().selectedPort;
    if (!port) {
      throw new Error("NO_PORT");
    }

    const cmd = [
      "-p",
      port,
      "-b",
      options.baudRate.value,
      "write-flash",
      "--flash-mode",
      options.spiMode.value,
      "0x0",
      path,
    ];

    if (options.eraseBeforeFlash.value) {
      cmd.push("--erase-all");
    }

    await runEsptool(cmd);
  }

  return { flashFirmware };
}
