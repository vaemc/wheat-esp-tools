import type { PetModelKind } from "./skins/types";

export const PET_SAFE = 28;

export function petSafeMargin(model: PetModelKind): number {
  if (model === "toon") return 36;
  if (model === "fig-sci") return 16;
  if (model === "vrm") return 18;
  return PET_SAFE;
}

export function clampPetZoom(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(-100, Math.round(value)));
}

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

export function petBodyBox(
  model: PetModelKind,
  zoomPercent = 0,
  screen: PetScreenMetrics = readPetScreenMetrics()
): { w: number; h: number } {
  const s = petScaleFromZoom(zoomPercent);
  const short = Math.min(screen.availW, screen.availH);

  if (model === "fig-sci") {
    const h = Math.round(
      Math.min(400, Math.max(240, screen.availH * 0.3)) * s
    );
    const w = Math.round(h * (288 / 473));
    return { w, h };
  }

  if (model === "toon") {
    const side = Math.round(
      Math.min(160, Math.max(88, short * 0.09)) * s
    );
    return { w: side, h: Math.round(side * 1.08) };
  }

  if (model === "vrm") {
    const h = Math.round(
      Math.min(320, Math.max(210, short * 0.24)) * s
    );
    const w = Math.round(h * 0.55);
    return { w, h };
  }

  const side = Math.round(
    Math.min(140, Math.max(112, short * 0.085)) * s
  );
  return { w: side, h: side };
}

export function petBubbleAnchor(
  model: PetModelKind,
  zoomPercent = 0
): { halfW: number; offsetY: number } {
  const box = petBodyBox(model, zoomPercent);
  const halfW = box.w / 2;
  if (model === "fig-sci") {
    return { halfW, offsetY: -box.h * 0.12 };
  }
  if (model === "toon") {
    return { halfW, offsetY: -box.h * 0.06 };
  }
  if (model === "vrm") {
    return { halfW, offsetY: -box.h * 0.18 };
  }
  return { halfW, offsetY: 0 };
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

export const PET_BUBBLE_W = 220;
export const PET_BUBBLE_H = 96;
export const PET_BUBBLE_W_WIDE = 280;
export const PET_BUBBLE_H_TALL = 200;
export const PET_BUBBLE_GAP = 12;
