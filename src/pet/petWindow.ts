import { WebviewWindow, getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { currentMonitor } from "@tauri-apps/api/window";
import { closeBubbleWindow } from "./bubbleWindow";
import { loadPetSettings } from "./settings";
import { resolveAppearance } from "./skins";
import { petWindowSize } from "./sizes";
import { PET_WINDOW_LABEL } from "./types";

function petUrl(): string {
  if (import.meta.env.DEV) {
    return `${window.location.origin}/src/pet/pet.html`;
  }
  return "src/pet/pet.html";
}

function currentPetWindowSize() {
  const s = loadPetSettings();
  return petWindowSize(
    resolveAppearance(s.modelKind, s.themeId).model,
    s.zoomPercent
  );
}

async function resolveDefaultPetPosition(): Promise<{ x: number; y: number }> {
  const marginX = 48;
  const marginY = 80;
  const { w } = currentPetWindowSize();
  try {
    const monitor = await currentMonitor();
    if (monitor) {
      const scale = monitor.scaleFactor || 1;
      const wp = monitor.workArea.position;
      const ws = monitor.workArea.size;
      const workRight = (wp.x + ws.width) / scale;
      const workTop = wp.y / scale;
      return {
        x: Math.round(workRight - w - marginX),
        y: Math.round(workTop + marginY),
      };
    }
  } catch {
    // ignore
  }
  const availW = window.screen?.availWidth ?? 1280;
  return {
    x: Math.max(marginX, Math.round(availW - w - marginX)),
    y: marginY,
  };
}

export async function isPetWindowOpen(): Promise<boolean> {
  const existing = await WebviewWindow.getByLabel(PET_WINDOW_LABEL);
  return existing != null;
}

export async function closePetWindow(): Promise<void> {
  await closeBubbleWindow();
  const existing = await WebviewWindow.getByLabel(PET_WINDOW_LABEL);
  if (!existing) return;
  try {
    // destroy：强制关掉，避免 close 再走 closeRequested 卡死主窗退出流程
    await existing.destroy();
  } catch {
    try {
      await existing.close();
    } catch {
      // ignore
    }
  }
}

export async function openPetWindow(): Promise<WebviewWindow | null> {
  const existing = await WebviewWindow.getByLabel(PET_WINDOW_LABEL);
  if (existing) {
    try {
      await existing.show();
      await existing.setAlwaysOnTop(true);
    } catch {
      // ignore
    }
    return existing;
  }

  const pos = await resolveDefaultPetPosition();
  const size = currentPetWindowSize();
  const pet = new WebviewWindow(PET_WINDOW_LABEL, {
    url: petUrl(),
    title: "芯宠",
    width: size.w,
    height: size.h,
    resizable: false,
    maximizable: false,
    minimizable: false,
    decorations: false,
    transparent: true,
    shadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focus: false,
    visible: true,
    backgroundColor: [0, 0, 0, 0],
    center: false,
    x: pos.x,
    y: pos.y,
  });

  return await waitWebviewReady(pet);
}

async function waitWebviewReady(
  win: WebviewWindow,
  timeoutMs = 2500
): Promise<WebviewWindow | null> {
  return await new Promise((resolve) => {
    let settled = false;
    const finish = (value: WebviewWindow | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    const timer = window.setTimeout(() => {
      void win.destroy().catch(() => undefined);
      finish(null);
    }, timeoutMs);
    void win.once("tauri://created", () => finish(win));
    void win.once("tauri://error", () => {
      void win.destroy().catch(() => undefined);
      finish(null);
    });
  });
}

export async function syncPetWindow(): Promise<void> {
  const settings = loadPetSettings();
  if (settings.enabled) {
    await openPetWindow();
  } else {
    await closePetWindow();
  }
}

let hostInited = false;

export async function initPetHost(): Promise<void> {
  if (hostInited) return;
  try {
    if (getCurrentWebviewWindow().label !== "main") return;
  } catch {
    return;
  }
  hostInited = true;

  await syncPetWindow();

  try {
    const main = getCurrentWebviewWindow();
    await main.onCloseRequested(async (event) => {
      event.preventDefault();
      try {
        await closePetWindow();
      } catch {
        // ignore
      }
      try {
        await main.destroy();
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }
}
