import {
  computed,
  onDeactivated,
  onUnmounted,
  reactive,
  ref,
} from "vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { message } from "ant-design-vue";
import type {
  ClassicBtDevicePayload,
  ClassicBtDeviceRecord,
  ClassicBtFilterState,
} from "../types";

const appWindow = getCurrentWebviewWindow();
const FLUSH_MS = 150;

function defaultFilter(): ClassicBtFilterState {
  return {
    name: "",
    address: "",
    pairedOnly: false,
    connectedOnly: false,
    rssiMin: -100,
  };
}

function mergeRssi(
  prev: number | null | undefined,
  next: number | null | undefined
): number | null {
  if (next == null) return prev ?? null;
  if (prev == null) return next;
  return Math.max(prev, next);
}

function matchesFilter(
  device: ClassicBtDeviceRecord,
  filter: ClassicBtFilterState
): boolean {
  const nameQ = filter.name.trim().toLowerCase();
  if (nameQ && !device.local_name.toLowerCase().includes(nameQ)) {
    return false;
  }

  const addrQ = filter.address.trim().toLowerCase();
  if (addrQ && !device.address.toLowerCase().includes(addrQ)) {
    return false;
  }

  if (filter.pairedOnly && !device.paired) {
    return false;
  }

  if (filter.connectedOnly && !device.connected) {
    return false;
  }

  if (device.rssi != null && device.rssi < filter.rssiMin) {
    return false;
  }

  return true;
}

function parsePayload(payload: unknown): ClassicBtDevicePayload | null {
  try {
    const data =
      typeof payload === "string" ? JSON.parse(payload) : payload;
    if (!data || typeof data !== "object") {
      return null;
    }
    const raw = data as Record<string, unknown>;
    const address = typeof raw.address === "string" ? raw.address : "";
    if (!address) {
      return null;
    }
    return {
      address,
      local_name: typeof raw.local_name === "string" ? raw.local_name : "",
      class_of_device:
        typeof raw.class_of_device === "string" ? raw.class_of_device : "",
      class_category:
        typeof raw.class_category === "string" ? raw.class_category : "",
      connected: Boolean(raw.connected),
      paired: Boolean(raw.paired),
      authenticated: Boolean(raw.authenticated),
      rssi: typeof raw.rssi === "number" ? raw.rssi : null,
    };
  } catch {
    return null;
  }
}

export function useClassicBtScanner() {
  const scanning = ref(false);
  const devices = ref(new Map<string, ClassicBtDeviceRecord>());
  const filter = reactive(defaultFilter());

  let unlisten: UnlistenFn | null = null;
  let unlistenError: UnlistenFn | null = null;
  let setupPromise: Promise<void> | null = null;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;

  const deviceList = computed(() =>
    [...devices.value.values()].sort((a, b) => {
      const ra = a.rssi ?? -999;
      const rb = b.rssi ?? -999;
      if (rb !== ra) return rb - ra;
      return b.lastSeen - a.lastSeen;
    })
  );

  const filteredDevices = computed(() =>
    deviceList.value.filter((d) => matchesFilter(d, filter))
  );

  const stats = computed(() => ({
    total: devices.value.size,
    visible: filteredDevices.value.length,
    connected: filteredDevices.value.filter((d) => d.connected).length,
    paired: filteredDevices.value.filter((d) => d.paired).length,
    strongest:
      filteredDevices.value.find((d) => d.rssi != null)?.rssi ?? null,
  }));

  function clearFlushTimer() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }

  function scheduleFlush() {
    if (flushTimer) {
      return;
    }
    flushTimer = setTimeout(() => {
      flushTimer = null;
      if (dirty) {
        dirty = false;
        devices.value = new Map(devices.value);
      }
    }, FLUSH_MS);
  }

  function upsert(payload: ClassicBtDevicePayload) {
    const now = Date.now();
    const prev = devices.value.get(payload.address);
    const next: ClassicBtDeviceRecord = {
      ...payload,
      local_name: payload.local_name ?? "",
      rssi: mergeRssi(prev?.rssi, payload.rssi ?? null),
      lastSeen: now,
      seenCount: (prev?.seenCount ?? 0) + 1,
      // 采用 payload 最新布尔值，避免 OR 粘住不回落
      connected: payload.connected,
      paired: payload.paired,
      authenticated: payload.authenticated,
    };
    devices.value.set(payload.address, next);
    dirty = true;
    scheduleFlush();
  }

  function resetFilter() {
    Object.assign(filter, defaultFilter());
  }

  function clearDevices() {
    devices.value = new Map();
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function invokeStartWithRetry() {
    let lastErr: unknown;
    for (let i = 0; i < 8; i++) {
      try {
        await invoke("start_classic_bluetooth_scan");
        return;
      } catch (err) {
        lastErr = err;
        const msg = typeof err === "string" ? err : String(err ?? "");
        if (!msg.includes("已在进行中") || i === 7) {
          throw err;
        }
        await sleep(80);
      }
    }
    throw lastErr;
  }

  async function startScan() {
    if (scanning.value) {
      return;
    }
    clearDevices();
    scanning.value = true;
    try {
      await invokeStartWithRetry();
    } catch (err) {
      scanning.value = false;
      clearFlushTimer();
      message.error(
        typeof err === "string" ? err : "启动经典蓝牙扫描失败"
      );
    }
  }

  async function stopScan() {
    if (!scanning.value) {
      return;
    }
    scanning.value = false;
    clearFlushTimer();
    try {
      await appWindow.emit("stop_classic_bluetooth_scan", {});
    } catch {
      /* ignore */
    }
  }

  async function toggleScan() {
    if (scanning.value) {
      await stopScan();
    } else {
      await startScan();
    }
  }

  async function setupListener() {
    if (unlisten && unlistenError) {
      return;
    }
    if (setupPromise) {
      await setupPromise;
      return;
    }
    setupPromise = (async () => {
      try {
        if (!unlisten) {
          unlisten = await listen<unknown>(
            "classic_bluetooth_scan_event",
            (event) => {
              const payload = parsePayload(event.payload);
              if (payload) {
                upsert(payload);
              }
            }
          );
        }
        if (!unlistenError) {
          unlistenError = await listen<string>(
            "classic_bluetooth_scan_error",
            (event) => {
              scanning.value = false;
              clearFlushTimer();
              message.error(event.payload || "经典蓝牙扫描出错");
            }
          );
        }
      } catch (err) {
        unlisten?.();
        unlisten = null;
        unlistenError?.();
        unlistenError = null;
        throw err;
      } finally {
        setupPromise = null;
      }
    })();
    await setupPromise;
  }

  onDeactivated(() => {
    void stopScan();
  });

  onUnmounted(() => {
    unlisten?.();
    unlisten = null;
    unlistenError?.();
    unlistenError = null;
    void stopScan();
  });

  return {
    scanning,
    filter,
    filteredDevices,
    stats,
    resetFilter,
    clearDevices,
    toggleScan,
    stopScan,
    setupListener,
  };
}
