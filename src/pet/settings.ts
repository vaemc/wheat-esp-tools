import {
  DEFAULT_PET_SETTINGS,
  PET_SETTINGS_EVENT,
  PET_SETTINGS_KEY,
  type PetSettings,
  type PetTone,
} from "./types";
import { isPetIdleMotion } from "./motions";
import {
  isPetModelKind,
  isPetThemeId,
  coerceThemeIdForModel,
  DEFAULT_PET_MODEL,
  DEFAULT_PET_THEME_ID,
} from "./skins";
import type { PetModelKind } from "./skins/types";
import {
  isPetPersonality,
  type PetPersonality,
} from "./personality";
import { clampPetZoom } from "./sizes";

function clampOpacity(value: number): number {
  if (Number.isNaN(value)) return DEFAULT_PET_SETTINGS.opacity;
  return Math.min(1, Math.max(0.3, value));
}

function normalizeTone(value: unknown): PetTone {
  return value === "snarky" ? "snarky" : "cute";
}

function normalizeDemoMotion(value: unknown): string {
  return isPetIdleMotion(value) ? value : DEFAULT_PET_SETTINGS.demoMotion;
}

function normalizePersonality(value: unknown): PetPersonality {
  return isPetPersonality(value)
    ? value
    : DEFAULT_PET_SETTINGS.personality;
}

function normalizeModelTheme(
  raw: Partial<PetSettings> | null | undefined
): { modelKind: PetModelKind; themeId: string } {
  let modelKind: PetModelKind = DEFAULT_PET_MODEL;
  let themeId: string = DEFAULT_PET_THEME_ID;

  if (isPetModelKind(raw?.modelKind)) {
    modelKind = raw.modelKind;
  }
  if (isPetThemeId(raw?.themeId)) {
    themeId = raw.themeId;
  }

  return {
    modelKind,
    themeId: coerceThemeIdForModel(themeId, modelKind),
  };
}

export function normalizePetSettings(
  raw: Partial<PetSettings> | null | undefined
): PetSettings {
  const { modelKind, themeId } = normalizeModelTheme(raw);
  return {
    enabled: Boolean(raw?.enabled),
    muted: Boolean(raw?.muted),
    opacity: clampOpacity(Number(raw?.opacity ?? DEFAULT_PET_SETTINGS.opacity)),
    tone: normalizeTone(raw?.tone),
    demoMotion: normalizeDemoMotion(raw?.demoMotion),
    modelKind,
    themeId,
    nickname: typeof raw?.nickname === "string" ? raw.nickname.trim() : "",
    personality: normalizePersonality(raw?.personality),
    zoomPercent: clampPetZoom(
      Number(raw?.zoomPercent ?? DEFAULT_PET_SETTINGS.zoomPercent)
    ),
    usbWatchEnabled:
      raw?.usbWatchEnabled === undefined
        ? DEFAULT_PET_SETTINGS.usbWatchEnabled
        : Boolean(raw.usbWatchEnabled),
  };
}

export function loadPetSettings(): PetSettings {
  try {
    const raw = localStorage.getItem(PET_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_PET_SETTINGS };
    return normalizePetSettings(JSON.parse(raw) as Partial<PetSettings>);
  } catch {
    return { ...DEFAULT_PET_SETTINGS };
  }
}

export function savePetSettings(settings: PetSettings): PetSettings {
  const next = normalizePetSettings(settings);
  localStorage.setItem(PET_SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export async function publishPetSettings(
  settings: PetSettings
): Promise<PetSettings> {
  const next = savePetSettings(settings);
  try {
    const { emit } = await import("@tauri-apps/api/event");
    await emit(PET_SETTINGS_EVENT, next);
  } catch {
    // ignore
  }
  return next;
}

export function patchPetSettings(
  patch: Partial<PetSettings>
): Promise<PetSettings> {
  return publishPetSettings({
    ...loadPetSettings(),
    ...patch,
  });
}
