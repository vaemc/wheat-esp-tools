import { computed, onUnmounted, reactive, ref } from "vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import { appWindow } from "@tauri-apps/api/window";
import type { BleDevicePayload, BleDeviceRecord, BleFilterState } from "../types";

const STALE_TTL_SEC = 10;
const PRUNE_INTERVAL_MS = 1000;

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
    const advHex = bytesToHex(device.adv).toLowerCase().replace(/\s/g, "");
    const mfgHex = Object.values(device.manufacturer_data)
      .flatMap((b) => b)
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    const svcHex = Object.values(device.service_data)
      .flatMap((b) => b)
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    const blob = (advHex + mfgHex + svcHex).toLowerCase();
    if (!blob.includes(advQ)) {
      return false;
    }
  }

  if (device.rssi < filter.rssiMin) {
    return false;
  }

  return true;
}

function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function useBleScanner() {
  const scanning = ref(false);
  const devices = ref(new Map<string, BleDeviceRecord>());
  const filter = reactive(defaultFilter());

  let unlisten: UnlistenFn | null = null;
  let pruneTimer: ReturnType<typeof setInterval> | null = null;

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
    devices.value = new Map(devices.value);
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

  async function startScan() {
    if (scanning.value) {
      return;
    }
    clearDevices();
    scanning.value = true;
    pruneTimer = setInterval(pruneStale, PRUNE_INTERVAL_MS);
    await invoke("start_ble_advertisement_scan");
  }

  async function stopScan() {
    if (!scanning.value) {
      return;
    }
    scanning.value = false;
    await appWindow.emit("stop_ble_advertisement_scan", {});
    if (pruneTimer) {
      clearInterval(pruneTimer);
      pruneTimer = null;
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
    unlisten = await listen<string>("ble_advertisement_scan_event", (event) => {
      try {
        const payload = JSON.parse(event.payload) as BleDevicePayload;
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
    if (pruneTimer) {
      clearInterval(pruneTimer);
    }
    if (scanning.value) {
      appWindow.emit("stop_ble_advertisement_scan", {});
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
    setupListener,
  };
}
