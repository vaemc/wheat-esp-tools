import { LogicalPosition } from "@tauri-apps/api/dpi";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";

/** smootherstep：比 cubic 更顺滑，起停更柔 */
function easeSmooth(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export async function pickRandomWorkPoint(
  winW: number,
  winH: number
): Promise<{ x: number; y: number } | null> {
  try {
    const monitor = await currentMonitor();
    if (!monitor) return null;
    const scale = monitor.scaleFactor || 1;
    const wp = monitor.workArea.position;
    const ws = monitor.workArea.size;
    const left = wp.x / scale;
    const top = wp.y / scale;
    const right = (wp.x + ws.width) / scale - winW;
    const bottom = (wp.y + ws.height) / scale - winH;
    if (right <= left + 8 || bottom <= top + 8) return null;
    return {
      x: Math.round(left + 24 + Math.random() * (right - left - 48)),
      y: Math.round(top + 24 + Math.random() * (bottom - top - 48)),
    };
  } catch {
    return null;
  }
}

export interface FlyFrameInfo {
  x: number;
  y: number;
  visualDx: number;
  visualDy: number;
}

/**
 * 平滑飞窗：
 * - 每帧算理想位置（约 60fps）
 * - 窗位 IPC 异步追赶（队列只保留最新点，不 await 阻塞）
 * - visualDx/Dy 用 CSS 补上窗位滞后，观感接近满帧
 */
export async function animatePetWindowTo(
  toX: number,
  toY: number,
  durationMs: number,
  signal?: { cancelled: boolean },
  onFrame?: (info: FlyFrameInfo) => void,
  ease: "smooth" | "walk" = "smooth"
): Promise<void> {
  const win = getCurrentWindow();
  const scale = await win.scaleFactor();
  const from = (await win.outerPosition()).toLogical(scale);
  const start = performance.now();

  let committed = { x: from.x, y: from.y };
  let pending: { x: number; y: number } | null = null;
  let writing = false;

  const easeFn = (t: number) => {
    if (ease === "walk") {
      const s = t * t * (3 - 2 * t);
      return s * 0.35 + t * 0.65;
    }
    return easeSmooth(t);
  };

  const flushWrite = () => {
    if (writing || !pending || signal?.cancelled) return;
    writing = true;
    const next = pending;
    pending = null;
    void win
      .setPosition(new LogicalPosition(next.x, next.y))
      .then(() => {
        committed = next;
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        writing = false;
        if (pending) flushWrite();
      });
  };

  await new Promise<void>((resolve) => {
    const step = (now: number) => {
      if (signal?.cancelled) {
        onFrame?.({ x: committed.x, y: committed.y, visualDx: 0, visualDy: 0 });
        resolve();
        return;
      }

      const t = clamp((now - start) / Math.max(1, durationMs), 0, 1);
      const e = easeFn(t);
      const x = from.x + (toX - from.x) * e;
      const y = from.y + (toY - from.y) * e;

      pending = { x, y };
      flushWrite();

      onFrame?.({
        x,
        y,
        visualDx: x - committed.x,
        visualDy: y - committed.y,
      });

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        pending = { x: toX, y: toY };
        flushWrite();
        void win
          .setPosition(new LogicalPosition(toX, toY))
          .catch(() => {})
          .finally(() => {
            onFrame?.({ x: toX, y: toY, visualDx: 0, visualDy: 0 });
            resolve();
          });
      }
    };
    requestAnimationFrame(step);
  });
}

export async function flyPetWindowRandom(
  winW: number,
  winH: number,
  durationMs = 1600,
  signal?: { cancelled: boolean },
  onFrame?: (info: FlyFrameInfo) => void
): Promise<boolean> {
  const dest = await pickRandomWorkPoint(winW, winH);
  if (!dest) return false;
  await animatePetWindowTo(dest.x, dest.y, durationMs, signal, onFrame);
  return !signal?.cancelled;
}

export interface WalkFrameInfo extends FlyFrameInfo {
  dirX: number;
  progress: number;
}

export async function walkPetWindowRandom(
  winW: number,
  winH: number,
  signal?: { cancelled: boolean },
  onFrame?: (info: WalkFrameInfo) => void,
  speedPxPerSec = 62
): Promise<boolean> {
  const dest = await pickRandomWorkPoint(winW, winH);
  if (!dest) return false;

  const win = getCurrentWindow();
  const scale = await win.scaleFactor();
  const from = (await win.outerPosition()).toLogical(scale);
  const toX = dest.x;
  const toY = from.y;
  const dist = Math.abs(toX - from.x);
  if (dist < 24) return false;

  const durationMs = clamp(
    (dist / Math.max(36, speedPxPerSec)) * 1000,
    2800,
    12000
  );
  const dirSign = toX >= from.x ? 1 : -1;
  let lastX = from.x;

  await animatePetWindowTo(
    toX,
    toY,
    durationMs,
    signal,
    (info) => {
      const dx = info.x - lastX;
      lastX = info.x;
      onFrame?.({
        ...info,
        dirX: Math.abs(dx) > 0.05 ? Math.sign(dx) : dirSign,
        progress: 0,
      });
    },
    "walk"
  );
  return !signal?.cancelled;
}

function sleep(ms: number, signal?: { cancelled: boolean }): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = (now: number) => {
      if (signal?.cancelled || now - start >= ms) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export type WormholePhase = "out" | "warp" | "in" | "done";

export async function teleportPetWindowWormhole(
  winW: number,
  winH: number,
  signal?: { cancelled: boolean },
  onPhase?: (phase: WormholePhase) => void
): Promise<boolean> {
  const dest = await pickRandomWorkPoint(winW, winH);
  if (!dest) return false;
  const win = getCurrentWindow();

  onPhase?.("out");
  await sleep(360, signal);
  if (signal?.cancelled) {
    onPhase?.("done");
    return false;
  }

  try {
    await win.setPosition(new LogicalPosition(dest.x, dest.y));
  } catch {
    onPhase?.("done");
    return false;
  }
  onPhase?.("warp");
  await sleep(280, signal);
  if (signal?.cancelled) {
    onPhase?.("done");
    return false;
  }

  onPhase?.("in");
  await sleep(480, signal);
  onPhase?.("done");
  return !signal?.cancelled;
}
