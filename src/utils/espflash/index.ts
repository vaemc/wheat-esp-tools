import { invoke } from "@tauri-apps/api/core";
import {
  ensureEspflashListeners,
  formatEspflashErrorDetail,
  formatEspflashMessage,
  newEspflashJobId,
} from "@/utils/espflash/events";
import { useEspflashStore } from "@/stores/espflash";

export interface FlashItem {
  offset: string;
  path: string;
}

export interface WriteFlashOptions {
  flashMode?: string;
  eraseAll?: boolean;
  before?: string;
  after?: string;
}

export interface EspDeviceInfo {
  chipType: string;
  chipDetail: string;
  revision: string;
  mac: string;
  crystal: string;
  features: string;
  flashSize: string;
  flashType: string;
  flashManufacturer: string;
  flashDevice: string;
  psram: string;
  security: string;
}

export const EMPTY_DEVICE_INFO: EspDeviceInfo = {
  chipType: "",
  chipDetail: "",
  revision: "",
  mac: "",
  crystal: "",
  features: "",
  flashSize: "",
  flashType: "",
  flashManufacturer: "",
  flashDevice: "",
  psram: "",
  security: "",
};

function parseBaud(baud: string | number, fallback = 115200): number {
  if (typeof baud === "number" && Number.isFinite(baud) && baud > 0) {
    return Math.floor(baud);
  }
  const n = Number.parseInt(String(baud).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function wrapInvokeError(err: unknown): Error {
  const msg =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : String(err ?? "ESPFLASH_FAILED");
  if (msg === "ESPFLASH_BUSY" || msg.includes("ESPFLASH_BUSY")) {
    return new Error("ESPFLASH_BUSY");
  }
  const wrapped = new Error("ESPFLASH_FAILED");
  (wrapped as unknown as { cause?: unknown }).cause = err;
  (wrapped as unknown as { detail?: string }).detail = msg;
  return wrapped;
}

async function withJob<T>(
  op: string,
  startMessageKey: string,
  run: (jobId: string) => Promise<T>
): Promise<T> {
  await ensureEspflashListeners();
  const store = useEspflashStore();
  await store.bind();

  if (store.busy) {
    throw new Error("ESPFLASH_BUSY");
  }

  const jobId = newEspflashJobId(op);
  store.begin(jobId, op, startMessageKey);
  try {
    const result = await run(jobId);
    store.end(jobId, true);
    return result;
  } catch (err) {
    const wrapped = wrapInvokeError(err);
    const raw =
      (wrapped as unknown as { detail?: string }).detail || wrapped.message;
    const detail =
      wrapped.message === "ESPFLASH_BUSY"
        ? formatEspflashMessage("busyShort")
        : formatEspflashMessage("failed", {
            error: formatEspflashErrorDetail(raw),
          });
    store.end(jobId, false, detail);
    throw wrapped;
  }
}

/** 多段 write-flash */
export async function writeFlash(
  port: string,
  baud: string | number,
  items: FlashItem[],
  options: WriteFlashOptions = {}
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  const {
    flashMode = "dio",
    eraseAll = false,
    before = "default-reset",
    after = "hard-reset",
  } = options;

  await withJob("write", "writeStarting", (jobId) =>
    invoke("espflash_write_flash", {
      args: {
        port,
        baud: parseBaud(baud),
        items,
        flashMode,
        eraseAll,
        before,
        after,
        jobId,
      },
    })
  );
}

/** 读取 Flash 区域到文件；size 可为 `"ALL"` */
export async function readFlash(
  port: string,
  baud: string | number,
  offset: string,
  size: string,
  savePath: string,
  options: Pick<WriteFlashOptions, "before" | "after"> = {}
): Promise<void> {
  const { before = "default-reset", after = "hard-reset" } = options;
  await withJob("read", "readStarting", (jobId) =>
    invoke("espflash_read_flash", {
      args: {
        port,
        baud: parseBaud(baud, 460800),
        offset,
        size,
        savePath,
        before,
        after,
        jobId,
      },
    })
  );
}

export async function eraseFlash(
  port: string,
  baud: string | number = 115200,
  options: Pick<WriteFlashOptions, "before" | "after"> = {}
): Promise<void> {
  const { before = "default-reset", after = "hard-reset" } = options;
  await withJob("erase", "eraseStarting", (jobId) =>
    invoke("espflash_erase_flash", {
      args: {
        port,
        baud: parseBaud(baud),
        before,
        after,
        jobId,
      },
    })
  );
}

export async function eraseRegion(
  port: string,
  baud: string | number,
  offset: string,
  size: string,
  options: Pick<WriteFlashOptions, "before" | "after"> = {}
): Promise<void> {
  const { before = "default-reset", after = "hard-reset" } = options;
  await withJob("erase_region", "eraseRegionStarting", (jobId) =>
    invoke("espflash_erase_region", {
      args: {
        port,
        baud: parseBaud(baud),
        offset,
        size,
        before,
        after,
        jobId,
      },
    })
  );
}

export async function fetchDeviceInfo(
  port: string,
  baud: string | number = 115200
): Promise<EspDeviceInfo> {
  return withJob("device_info", "deviceInfoStarting", (jobId) =>
    invoke<EspDeviceInfo>("espflash_device_info", {
      args: {
        port,
        baud: parseBaud(baud),
        before: "default-reset",
        after: "hard-reset",
        jobId,
      },
    })
  );
}

export async function mergeBin(
  outputPath: string,
  items: FlashItem[],
  chip = ""
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  await withJob("merge", "mergeStarting", (jobId) =>
    invoke("espflash_merge_bin", {
      args: {
        outputPath,
        items,
        chip,
        jobId,
      },
    })
  );
}

export async function listSupportedChips(): Promise<string[]> {
  return invoke<string[]>("espflash_list_chips");
}
