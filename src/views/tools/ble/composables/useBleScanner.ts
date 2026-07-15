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
import type { BleDevicePayload, BleDeviceRecord, BleFilterState } from "../types";
import { bytesToHex } from "../utils/bleFormat";

const appWindow = getCurrentWebviewWindow();

const STALE_TTL_SEC = 10;
const PRUNE_INTERVAL_MS = 1000;
const FLUSH_MS = 150;
const RESTART_RETRY_MS = 80;
const RESTART_RETRY_MAX = 8;

function defaultFilter(): BleFilterState {
  return {
    name: "",
    address: "",
    adv: "",
    uuid: "",
    rssiMin: -100,
  };
}

function matchesFilter(device: BleDeviceRecord, filter: BleFilterState): boolean {
  const nameQ = filter.name.trim().toLowerCase();
  if (nameQ && !device.local_name.toLowerCase().includes(nameQ)) {
    return false;
  }

  const addrQ = filter.address.trim().toLowerCase();
  if (addrQ && !device.address.toLowerCase().includes(addrQ)) {
    return false;
  }

  const uuidQ = filter.uuid.trim().toLowerCase();
  if (uuidQ) {
    const hit = device.services.some((s) => s.toLowerCase().includes(uuidQ));
    if (!hit) {
      return false;
    }
  }

  const advQ = filter.adv.trim().toLowerCase().replace(/\s/g, "");
  if (advQ) {
    const advHex = bytesToHex(device.adv, "").toLowerCase();
    const mfgHex = bytesToHex(
      Object.values(device.manufacturer_data).flatMap((b) => b),
      ""
    ).toLowerCase();
    const svcHex = bytesToHex(
      Object.values(device.service_data).flatMap((b) => b),
      ""
    ).toLowerCase();
    const blob = advHex + mfgHex + svcHex;
    if (!blob.includes(advQ)) {
      return false;
    }
  }

  if (device.rssi < filter.rssiMin) {
    return false;
  }

  return true;
}

function asByteArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((x): x is number => typeof x === "number");
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((x): x is string => typeof x === "string");
}

function asRecordNumberArrays(value: unknown): Record<string, number[]> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const out: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = asByteArray(v);
  }
  return out;
}

function parsePayload(payload: unknown): BleDevicePayload | null {
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
      rssi: typeof raw.rssi === "number" ? raw.rssi : 0,
      manufacturer_data: asRecordNumberArrays(raw.manufacturer_data),
      services: asStringArray(raw.services),
      service_data: asRecordNumberArrays(raw.service_data),
      adv: asByteArray(raw.adv),
    };
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useBleScanner() {
  const scanning = ref(false);
  const devices = ref(new Map<string, BleDeviceRecord>());
  const filter = reactive(defaultFilter());

  let unlisten: UnlistenFn | null = null;
  let setupPromise: Promise<void> | null = null;
  let pruneTimer: ReturnType<typeof setInterval> | null = null;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;

  const deviceList = computed(() =>
    [...devices.value.values()].sort((a, b) => b.rssi - a.rssi)
  );

  const filteredDevices = computed(() =>
    deviceList.value.filter((d) => matchesFilter(d, filter))
  );

  const stats = computed(() => ({
    total: devices.value.size,
    visible: filteredDevices.value.length,
    strongest: filteredDevices.value[0]?.rssi ?? null,
  }));

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

  function upsert(payload: BleDevicePayload) {
    const now = Date.now();
    const prev = devices.value.get(payload.address);
    const next: BleDeviceRecord = {
      ...payload,
      local_name: payload.local_name ?? "",
      lastSeen: now,
      seenCount: (prev?.seenCount ?? 0) + 1,
      manufacturer_data: {
        ...prev?.manufacturer_data,
        ...payload.manufacturer_data,
      },
      services:
        payload.services.length > 0 ? payload.services : (prev?.services ?? []),
      service_data: {
        ...prev?.service_data,
        ...payload.service_data,
      },
      adv: payload.adv.length > 0 ? payload.adv : (prev?.adv ?? []),
    };
    devices.value.set(payload.address, next);
    dirty = true;
    scheduleFlush();
  }

  function pruneStale() {
    const cutoff = Date.now() - STALE_TTL_SEC * 1000;
    let changed = false;
    for (const [addr, dev] of devices.value) {
      if (dev.lastSeen < cutoff) {
        devices.value.delete(addr);
        changed = true;
      }
    }
    if (changed) {
      devices.value = new Map(devices.value);
    }
  }

  function resetFilter() {
    Object.assign(filter, defaultFilter());
  }

  function clearDevices() {
    devices.value = new Map();
  }

  function clearTimers() {
    if (pruneTimer) {
      clearInterval(pruneTimer);
      pruneTimer = null;
    }
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }

  async function invokeStartWithRetry() {
    let lastErr: unknown;
    for (let i = 0; i < RESTART_RETRY_MAX; i++) {
      try {
        await invoke("start_ble_advertisement_scan");
        return;
      } catch (err) {
        lastErr = err;
        const msg = typeof err === "string" ? err : String(err ?? "");
        if (!msg.includes("已在进行中") || i === RESTART_RETRY_MAX - 1) {
          throw err;
        }
        await sleep(RESTART_RETRY_MS);
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
    pruneTimer = setInterval(pruneStale, PRUNE_INTERVAL_MS);
    try {
      await invokeStartWithRetry();
    } catch (err) {
      scanning.value = false;
      clearTimers();
      message.error(
        typeof err === "string" ? err : "启动 BLE 扫描失败"
      );
    }
  }

  async function stopScan() {
    if (!scanning.value) {
      return;
    }
    scanning.value = false;
    clearTimers();
    try {
      await appWindow.emit("stop_ble_advertisement_scan", {});
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
    if (unlisten) {
      return;
    }
    if (setupPromise) {
      await setupPromise;
      return;
    }
    setupPromise = (async () => {
      try {
        unlisten = await listen<unknown>(
          "ble_advertisement_scan_event",
          (event) => {
            const payload = parsePayload(event.payload);
            if (payload) {
              upsert(payload);
            }
          }
        );
      } catch (err) {
        unlisten = null;
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
