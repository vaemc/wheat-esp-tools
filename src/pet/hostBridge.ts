import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { PET_OPEN_SETTINGS_EVENT } from "./motions";
import { initPetHost } from "./petWindow";

export const PET_OPEN_SETTINGS_KEY = "wheat-esp-pet-open-settings";
const PET_BUS_NAME = "wheat-esp-pet";

export async function requestOpenPetSettings(): Promise<void> {
  try {
    localStorage.setItem(
      PET_OPEN_SETTINGS_KEY,
      JSON.stringify({ at: Date.now() })
    );
  } catch {
    // ignore
  }
  try {
    const bus = new BroadcastChannel(PET_BUS_NAME);
    bus.postMessage({ type: "open-settings", at: Date.now() });
    bus.close();
  } catch {
    // ignore
  }
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const { emit, emitTo } = await import("@tauri-apps/api/event");
    const main = await WebviewWindow.getByLabel("main");
    if (main) {
      try {
        await main.unminimize();
      } catch {
        // ignore
      }
      await main.show();
      await main.setFocus();
    }
    try {
      await emitTo("main", PET_OPEN_SETTINGS_EVENT, null);
    } catch {
      // ignore
    }
    await emit(PET_OPEN_SETTINGS_EVENT, null);
  } catch {
    // ignore
  }
}

export function initPetHostBridge(onOpenSettings: () => void): () => void {
  void initPetHost();

  let unlisten: UnlistenFn | null = null;
  void listen(PET_OPEN_SETTINGS_EVENT, () => {
    onOpenSettings();
  }).then((fn) => {
    unlisten = fn;
  });

  const onStorage = (ev: StorageEvent) => {
    if (ev.key !== PET_OPEN_SETTINGS_KEY || !ev.newValue) return;
    onOpenSettings();
  };
  window.addEventListener("storage", onStorage);

  let bus: BroadcastChannel | null = null;
  try {
    bus = new BroadcastChannel(PET_BUS_NAME);
    bus.onmessage = (ev) => {
      if (ev.data?.type === "open-settings") onOpenSettings();
    };
  } catch {
    // ignore
  }

  return () => {
    unlisten?.();
    unlisten = null;
    window.removeEventListener("storage", onStorage);
    bus?.close();
    bus = null;
  };
}
