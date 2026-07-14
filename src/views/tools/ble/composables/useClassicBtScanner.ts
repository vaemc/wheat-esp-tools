import { computed, onUnmounted, reactive, ref } from "vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type {
  ClassicBtDevicePayload,
  ClassicBtDeviceRecord,
  ClassicBtFilterState,
} from "../types";
const appWindow = getCurrentWebviewWindow()

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

export function useClassicBtScanner() {
  const scanning = ref(false);
  const devices = ref(new Map<string, ClassicBtDeviceRecord>());
  const filter = reactive(defaultFilter());

  let unlisten: UnlistenFn | null = null;

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

  function upsert(payload: ClassicBtDevicePayload) {
    const now = Date.now();
    const prev = devices.value.get(payload.address);
    const next: ClassicBtDeviceRecord = {
      ...payload,
      local_name: payload.local_name ?? "",
      rssi: mergeRssi(prev?.rssi, payload.rssi ?? null),
      lastSeen: now,
      seenCount: (prev?.seenCount ?? 0) + 1,
      connected: payload.connected || (prev?.connected ?? false),
      paired: payload.paired || (prev?.paired ?? false),
      authenticated: payload.authenticated || (prev?.authenticated ?? false),
    };
    devices.value.set(payload.address, next);
    devices.value = new Map(devices.value);
  }

  function resetFilter() {
    Object.assign(filter, defaultFilter());
  }

  function clearDevices() {
    devices.value = new Map();
  }

  async function startScan() {
    if (scanning.value) {
      return;
    }
    clearDevices();
    scanning.value = true;
    await invoke("start_classic_bluetooth_scan");
  }

  async function stopScan() {
    if (!scanning.value) {
      return;
    }
    scanning.value = false;
    await appWindow.emit("stop_classic_bluetooth_scan", {});
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
    unlisten = await listen<string>("classic_bluetooth_scan_event", (event) => {
      try {
        const payload = JSON.parse(event.payload) as ClassicBtDevicePayload;
        if (payload.address) {
          upsert(payload);
        }
      } catch {
        /* ignore malformed */
      }
    });
  }

  onUnmounted(() => {
    unlisten?.();
    if (scanning.value) {
      appWindow.emit("stop_classic_bluetooth_scan", {});
    }
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
