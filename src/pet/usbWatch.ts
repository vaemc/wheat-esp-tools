import { getSerialPortDetails } from "@/utils/common";
import type { SerialPortDetail } from "@/types/serial";
import {
  type PetUsbAnnouncePayload,
} from "./types";

export { buildUsbAnnounceText, formatPortLine } from "./usbFormat";

const POLL_MS = 1500;

export type PetUsbAnnounceHandler = (payload: PetUsbAnnouncePayload) => void;

let timer: ReturnType<typeof setInterval> | null = null;
let knownPorts = new Set<string>();
let bootstrapped = false;
let polling = false;
let handler: PetUsbAnnounceHandler | null = null;

function normalizePortKey(name: string): string {
  const upper = name.toUpperCase();
  const m = upper.match(/COM\d+/);
  return m ? m[0] : upper.replace(/^\\\\\.\\/, "");
}

function portKey(p: SerialPortDetail): string {
  return normalizePortKey(p.portName);
}

async function pollOnce(): Promise<void> {
  if (polling || !handler) return;
  polling = true;
  try {
    const list = await getSerialPortDetails();
    const next = new Set(list.map(portKey));

    if (!bootstrapped) {
      knownPorts = next;
      bootstrapped = true;
      return;
    }

    const addedKeys = [...next].filter((name) => !knownPorts.has(name));
    knownPorts = next;

    if (addedKeys.length === 0) return;

    const addedNames = list
      .filter((p) => addedKeys.includes(portKey(p)))
      .map((p) => p.portName);

    const payload: PetUsbAnnouncePayload = {
      ports: list.map((p) => ({
        portName: p.portName,
        friendlyName: p.friendlyName,
        description: p.description,
      })),
      added: addedNames.length > 0 ? addedNames : addedKeys,
    };
    handler(payload);
  } catch (err) {
    console.warn("[pet] usb watch poll failed", err);
  } finally {
    polling = false;
  }
}

export function startPetUsbWatch(onAnnounce: PetUsbAnnounceHandler): void {
  handler = onAnnounce;
  if (timer) return;
  bootstrapped = false;
  knownPorts = new Set();
  void pollOnce();
  timer = setInterval(() => {
    void pollOnce();
  }, POLL_MS);
}

export function stopPetUsbWatch(): void {
  handler = null;
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  bootstrapped = false;
  knownPorts = new Set();
}

export function syncPetUsbWatch(
  enabled: boolean,
  onAnnounce: PetUsbAnnounceHandler
): void {
  if (enabled) {
    startPetUsbWatch(onAnnounce);
  } else {
    stopPetUsbWatch();
  }
}
