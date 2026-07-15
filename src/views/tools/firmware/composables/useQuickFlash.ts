import { runEsptoolWriteFlash } from "@/utils/esptoolWrite";
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

    await runEsptoolWriteFlash(
      port,
      options.baudRate.value,
      [{ offset: "0x0", path }],
      {
        flashMode: options.spiMode.value,
        eraseAll: options.eraseBeforeFlash.value,
      }
    );
  }

  return { flashFirmware };
}
