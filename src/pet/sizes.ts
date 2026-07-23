import type { PetModelKind } from "./skins/types";

/** 四周安全边距：覆盖环绕飞行 / 拖尾流星（命中区仍只在本体） */
export const PET_SAFE = 130;

/** 按模型收一点飞行动画边距，避免窗体过大 */
export function petSafeMargin(model: PetModelKind): number {
  if (model === "toon") return 140;
  if (model === "fig-sci") return 64;
  if (model === "vrm") return 64;
  return PET_SAFE;
}

/**
 * 桌宠尺寸百分比 -100~+100 → 本体约 20%~200%
 * （字段仍叫 zoomPercent，语义为桌宠大小）
 */
export function clampPetZoom(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(-100, Math.round(value)));
}

/** 预览滚轮额外放大 0~40（仅预览，不写进桌宠；避免放大撑破舞台） */
export function clampPreviewBoost(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(40, Math.max(0, Math.round(value)));
}

export function petScaleFromZoom(zoomPercent: number): number {
  return Math.max(0.2, 1 + clampPetZoom(zoomPercent) / 100);
}

export function previewBoostScale(boostPercent: number): number {
  return 1 + clampPreviewBoost(boostPercent) / 100;
}

export interface PetScreenMetrics {
  availW: number;
  availH: number;
}

/** 读取当前屏可用区（逻辑像素）；桌宠/预览共用，保证跨显示器占比一致 */
export function readPetScreenMetrics(): PetScreenMetrics {
  try {
    const availW = window.screen?.availWidth ?? 1280;
    const availH = window.screen?.availHeight ?? 800;
    return {
      availW: Math.max(800, availW),
      availH: Math.max(600, availH),
    };
  } catch {
    return { availW: 1280, availH: 800 };
  }
}

/**
 * 按屏幕比例算默认本体尺寸（再乘桌宠 size zoom）。
 * - 芯宠：短边约 9.5%
 * - 梨宝立绘：屏高约 42%，宽按 2:3.3
 * - 灵宠：近似正方形，贴近像素精灵可视体积
 */
export function petBodyBox(
  model: PetModelKind,
  zoomPercent = 0,
  screen: PetScreenMetrics = readPetScreenMetrics()
): { w: number; h: number } {
  const s = petScaleFromZoom(zoomPercent);
  const short = Math.min(screen.availW, screen.availH);

  if (model === "fig-sci") {
    const h = Math.round(
      Math.min(560, Math.max(300, screen.availH * 0.42)) * s
    );
    const w = Math.round(h * (288 / 473));
    return { w, h };
  }

  if (model === "toon") {
    const side = Math.round(
      Math.min(220, Math.max(108, short * 0.12)) * s
    );
    return { w: side, h: side };
  }

  if (model === "vrm") {
    const h = Math.round(
      Math.min(420, Math.max(260, short * 0.32)) * s
    );
    const w = Math.round(h * 0.58);
    return { w, h };
  }

  const side = Math.round(
    Math.min(168, Math.max(92, short * 0.095)) * s
  );
  return { w: side, h: side };
}

/**
 * 气泡锚点：相对窗口中心的本体半宽 / 垂直偏移（逻辑像素）
 * gap 固定，不随缩放漂移
 */
export function petBubbleAnchor(
  model: PetModelKind,
  zoomPercent = 0
): { halfW: number; offsetY: number } {
  const box = petBodyBox(model, zoomPercent);
  if (model === "fig-sci") {
    return { halfW: box.w * 0.4, offsetY: -box.h * 0.12 };
  }
  if (model === "toon") {
    return { halfW: box.w * 0.46, offsetY: -box.h * 0.06 };
  }
  if (model === "vrm") {
    return { halfW: box.w * 0.42, offsetY: -box.h * 0.18 };
  }
  return { halfW: box.w * 0.5, offsetY: 0 };
}

export function petWindowSize(
  model: PetModelKind,
  zoomPercent = 0,
  screen?: PetScreenMetrics
): { w: number; h: number } {
  const body = petBodyBox(model, zoomPercent, screen ?? readPetScreenMetrics());
  const safe = petSafeMargin(model);
  return {
    w: body.w + safe * 2,
    h: body.h + safe * 2,
  };
}

/** 独立气泡窗（短句默认） */
export const PET_BUBBLE_W = 220;
export const PET_BUBBLE_H = 96;
export const PET_BUBBLE_W_WIDE = 280;
export const PET_BUBBLE_H_TALL = 200;
/** 角色边缘到气泡的固定间距（逻辑像素，不随缩放变） */
export const PET_BUBBLE_GAP = 10;

/** @deprecated 兼容旧引用；实际尺寸由 petBodyBox 按屏比计算 */
export const PET_CHIP = 108;
/** @deprecated */
export const PET_FIG_W = 288;
/** @deprecated */
export const PET_FIG_H = 473;
