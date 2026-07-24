import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { emit, emitTo } from "@tauri-apps/api/event";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  PET_BUBBLE_EVENT,
  PET_BUBBLE_HIDE_EVENT,
  PET_BUBBLE_LABEL,
  type PetBubblePayload,
} from "./bubbleTypes";
import {
  PET_BUBBLE_GAP,
  PET_BUBBLE_H,
  PET_BUBBLE_H_TALL,
  PET_BUBBLE_W,
  PET_BUBBLE_W_WIDE,
  petBodyBox,
  petBubbleAnchor,
} from "./sizes";
import { loadPetSettings } from "./settings";
import { resolveAppearance } from "./skins";
import type { PetTone } from "./types";

function bubbleUrl(): string {
  if (import.meta.env.DEV) {
    return `${window.location.origin}/src/pet/pet-bubble.html`;
  }
  return "src/pet/pet-bubble.html";
}

export async function closeBubbleWindow(): Promise<void> {
  const existing = await WebviewWindow.getByLabel(PET_BUBBLE_LABEL);
  if (!existing) return;
  try {
    await existing.destroy();
  } catch {
    try {
      await existing.close();
    } catch {
      // ignore
    }
  }
}

async function ensureBubbleWindow(): Promise<WebviewWindow | null> {
  const existing = await WebviewWindow.getByLabel(PET_BUBBLE_LABEL);
  if (existing) return existing;

  const win = new WebviewWindow(PET_BUBBLE_LABEL, {
    url: bubbleUrl(),
    title: "Chip Pet Bubble",
    width: PET_BUBBLE_W,
    height: PET_BUBBLE_H,
    resizable: false,
    maximizable: false,
    minimizable: false,
    decorations: false,
    transparent: true,
    shadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focus: false,
    visible: false,
    backgroundColor: [0, 0, 0, 0],
  });

  return await waitWebviewReady(win);
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

function clamp(n: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, n));
}

function resolveBubbleSize(text: string): { w: number; h: number } {
  const lines = text.split("\n").length;
  if (lines >= 3 || text.length > 60) {
    const extra = Math.min(120, Math.max(0, (lines - 2) * 22));
    return {
      w: PET_BUBBLE_W_WIDE,
      h: Math.min(PET_BUBBLE_H_TALL, PET_BUBBLE_H + 28 + extra),
    };
  }
  return { w: PET_BUBBLE_W, h: PET_BUBBLE_H };
}

async function resolveBubblePlacement(
  bubbleW: number,
  bubbleH: number
): Promise<{
  x: number;
  y: number;
  side: "left" | "right";
}> {
  const pet = getCurrentWindow();
  const scale = await pet.scaleFactor();
  const outer = (await pet.outerPosition()).toLogical(scale);
  const size = (await pet.outerSize()).toLogical(scale);
  const monitor = await currentMonitor();

  const gap = PET_BUBBLE_GAP;
  const s = loadPetSettings();
  const model = resolveAppearance(s.modelKind, s.themeId).model;
  const body = petBodyBox(model, s.zoomPercent);
  const anchor = petBubbleAnchor(model, s.zoomPercent);
  const halfW = body.w / 2;
  const halfH = body.h / 2;
  const petCenterX = outer.x + size.width / 2;
  const petCenterY = outer.y + size.height / 2;
  const bodyLeft = petCenterX - halfW;
  const bodyRight = petCenterX + halfW;
  const bodyTop = petCenterY - halfH;
  const bubbleAnchorY = petCenterY + anchor.offsetY;

  let workLeft = 0;
  let workTop = 0;
  let workRight = (window.screen?.availWidth ?? 1280) || 1280;
  let workBottom = (window.screen?.availHeight ?? 800) || 800;

  if (monitor) {
    const wp = monitor.workArea.position;
    const ws = monitor.workArea.size;
    workLeft = wp.x / scale;
    workTop = wp.y / scale;
    workRight = (wp.x + ws.width) / scale;
    workBottom = (wp.y + ws.height) / scale;
  }

  const spaceRight = workRight - bodyRight;
  const spaceLeft = bodyLeft - workLeft;
  const need = bubbleW + gap;
  let side: "left" | "right";
  if (spaceRight >= need) {
    side = "right";
  } else if (spaceLeft >= need) {
    side = "left";
  } else {
    side = spaceRight >= spaceLeft ? "right" : "left";
  }

  let x = side === "right" ? bodyRight + gap : bodyLeft - gap - bubbleW;
  let y = bubbleAnchorY - bubbleH / 2;

  const minX = workLeft + 4;
  const maxX = Math.max(minX, workRight - bubbleW - 4);
  const minY = workTop + 4;
  const maxY = Math.max(minY, workBottom - bubbleH - 4);

  const clampedX = clamp(x, minX, maxX);
  const overlapsBody =
    (side === "right" && clampedX < bodyRight + gap - 0.5) ||
    (side === "left" && clampedX + bubbleW > bodyLeft - gap + 0.5);

  if (overlapsBody) {
    if (side === "left" && spaceRight >= need) {
      side = "right";
      x = clamp(bodyRight + gap, minX, maxX);
      y = clamp(bubbleAnchorY - bubbleH / 2, minY, maxY);
    } else if (side === "right" && spaceLeft >= need) {
      side = "left";
      x = clamp(bodyLeft - gap - bubbleW, minX, maxX);
      y = clamp(bubbleAnchorY - bubbleH / 2, minY, maxY);
    } else {
      side = "right";
      x = clamp(petCenterX - bubbleW / 2, minX, maxX);
      y = clamp(bodyTop - gap - bubbleH, minY, maxY);
    }
  } else {
    x = clampedX;
    y = clamp(y, minY, maxY);
  }

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    x = bodyRight + gap;
    y = bubbleAnchorY - bubbleH / 2;
  }

  return { x: Math.round(x), y: Math.round(y), side };
}

async function pushBubblePayload(
  payload: PetBubblePayload & { at: number }
): Promise<void> {
  try {
    localStorage.setItem(
      "wheat-esp-pet-bubble-payload",
      JSON.stringify(payload)
    );
  } catch {
    // ignore
  }
  try {
    await emitTo(PET_BUBBLE_LABEL, PET_BUBBLE_EVENT, payload);
  } catch {
    // ignore
  }
}

async function applyBubbleGeometry(
  win: WebviewWindow,
  w: number,
  h: number,
  x: number,
  y: number
): Promise<void> {
  await win.setSize(new LogicalSize(w, h));
  await win.setPosition(new LogicalPosition(x, y));
}

let activeBubble:
  | { w: number; h: number; until: number }
  | null = null;

export async function syncPetBubbleToPet(): Promise<void> {
  if (!activeBubble || Date.now() > activeBubble.until) {
    activeBubble = null;
    return;
  }
  const existing = await WebviewWindow.getByLabel(PET_BUBBLE_LABEL);
  if (!existing) return;
  try {
    const visible = await existing.isVisible();
    if (!visible) return;
  } catch {
    return;
  }
  try {
    const place = await resolveBubblePlacement(
      activeBubble.w,
      activeBubble.h
    );
    await existing.setPosition(new LogicalPosition(place.x, place.y));
  } catch {
    // ignore
  }
}

export async function showPetBubble(options: {
  text: string;
  tone: PetTone;
  durationMs?: number;
}): Promise<void> {
  const durationMs = options.durationMs ?? 4500;
  const win = await ensureBubbleWindow();
  if (!win) return;

  const box = resolveBubbleSize(options.text);
  const place = await resolveBubblePlacement(box.w, box.h);
  activeBubble = {
    w: box.w,
    h: box.h,
    until: Date.now() + durationMs + 400,
  };

  try {
    await applyBubbleGeometry(win, box.w, box.h, place.x, place.y);
    await win.setAlwaysOnTop(true);
    try {
      await win.setShadow(false);
    } catch {
      // ignore
    }
    await win.show();
    // 透明窗在 Windows 上偶发首次定位落到左上角，show 后再钉一次
    await applyBubbleGeometry(win, box.w, box.h, place.x, place.y);
    window.setTimeout(() => {
      void applyBubbleGeometry(win, box.w, box.h, place.x, place.y);
    }, 48);
  } catch (err) {
    console.warn("[pet] bubble place failed", err);
  }

  const payload: PetBubblePayload & { at: number } = {
    text: options.text,
    tone: options.tone,
    side: place.side,
    durationMs,
    at: Date.now(),
  };

  await new Promise((r) => window.setTimeout(r, 80));
  await pushBubblePayload(payload);
  window.setTimeout(() => {
    void pushBubblePayload(payload);
  }, 220);
}

export async function hidePetBubble(): Promise<void> {
  activeBubble = null;
  try {
    await emitTo(PET_BUBBLE_LABEL, PET_BUBBLE_HIDE_EVENT, null);
  } catch {
    // ignore
  }
  try {
    await emit(PET_BUBBLE_HIDE_EVENT, null);
  } catch {
    // ignore
  }
  const existing = await WebviewWindow.getByLabel(PET_BUBBLE_LABEL);
  if (!existing) return;
  try {
    await existing.hide();
  } catch {
    // ignore
  }
}
