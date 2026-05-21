import cli, { execute } from "@/utils/cli";
import type { useFlashOptions } from "@/composables/useFlashOptions";

type FlashOptions = Pick<
  ReturnType<typeof useFlashOptions>,
  "baudRate" | "spiMode" | "eraseBeforeFlash"
>;

export function useQuickFlash(options: FlashOptions) {
  async function flashFirmware(path: string) {
    const port = localStorage.getItem("port");
    if (!port) {
      throw new Error("NO_PORT");
    }

    const cmd = [
      "-p",
      port,
      "-b",
      options.baudRate.value,
      "write_flash",
      "--flash_mode",
      options.spiMode.value,
      "0x0",
      path,
    ];

    if (options.eraseBeforeFlash.value) {
      cmd.push("--erase-all");
    }

    execute("esptool", cmd);

    await new Promise<void>((resolve) => {
      cli.on("close", () => {
        cli.all.clear();
        resolve();
      });
    });
  }

  return { flashFirmware };
}
