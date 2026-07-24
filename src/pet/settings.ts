import {
  createDefaultProfiles,
  DEFAULT_PET_SETTINGS,
  defaultProfileForModel,
  PET_MODEL_KINDS,
  PET_SETTINGS_EVENT,
  PET_SETTINGS_KEY,
  type PetModelProfile,
  type PetModelProfiles,
  type PetSettings,
  type PetTone,
} from "./types";
import { demoMotionsForModel, isPetIdleMotion } from "./motions";
import {
  isPetModelKind,
  isPetThemeId,
  coerceThemeIdForModel,
  DEFAULT_PET_MODEL,
  type PetModelKind,
} from "./skins";
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

function normalizeDemoMotion(
  value: unknown,
  model: PetModelKind
): string {
  if (isPetIdleMotion(value)) {
    const allowed = demoMotionsForModel(model);
    if (allowed.includes(value)) return value;
  }
  return defaultProfileForModel(model).demoMotion;
}

function normalizePersonality(value: unknown): PetPersonality {
  return isPetPersonality(value)
    ? value
    : DEFAULT_PET_SETTINGS.personality;
}

type ProfileFallbacks = Pick<
  PetModelProfile,
  "muted" | "opacity" | "usbWatchEnabled" | "randomIdleEnabled"
>;

function normalizeOneProfile(
  model: PetModelKind,
  raw: Partial<PetModelProfile> | null | undefined,
  fallbacks?: Partial<ProfileFallbacks>
): PetModelProfile {
  const base = defaultProfileForModel(model);
  const themeRaw =
    typeof raw?.themeId === "string" && isPetThemeId(raw.themeId)
      ? raw.themeId
      : base.themeId;
  return {
    nickname: typeof raw?.nickname === "string" ? raw.nickname.trim() : "",
    personality: normalizePersonality(raw?.personality ?? base.personality),
    tone: normalizeTone(raw?.tone ?? base.tone),
    themeId: coerceThemeIdForModel(themeRaw, model),
    zoomPercent: clampPetZoom(
      Number(raw?.zoomPercent ?? base.zoomPercent)
    ),
    demoMotion: normalizeDemoMotion(
      raw?.demoMotion ?? base.demoMotion,
      model
    ),
    muted:
      raw?.muted === undefined
        ? Boolean(fallbacks?.muted ?? base.muted)
        : Boolean(raw.muted),
    opacity: clampOpacity(
      Number(
        raw?.opacity === undefined
          ? (fallbacks?.opacity ?? base.opacity)
          : raw.opacity
      )
    ),
    usbWatchEnabled:
      raw?.usbWatchEnabled === undefined
        ? Boolean(fallbacks?.usbWatchEnabled ?? base.usbWatchEnabled)
        : Boolean(raw.usbWatchEnabled),
    randomIdleEnabled:
      raw?.randomIdleEnabled === undefined
        ? Boolean(fallbacks?.randomIdleEnabled ?? base.randomIdleEnabled)
        : Boolean(raw.randomIdleEnabled),
  };
}

function legacySharedFallbacks(
  raw: Partial<PetSettings> | null | undefined
): ProfileFallbacks {
  return {
    muted:
      raw?.muted === undefined
        ? DEFAULT_PET_SETTINGS.muted
        : Boolean(raw.muted),
    opacity: clampOpacity(
      Number(raw?.opacity ?? DEFAULT_PET_SETTINGS.opacity)
    ),
    usbWatchEnabled:
      raw?.usbWatchEnabled === undefined
        ? DEFAULT_PET_SETTINGS.usbWatchEnabled
        : Boolean(raw.usbWatchEnabled),
    randomIdleEnabled:
      raw?.randomIdleEnabled === undefined
        ? DEFAULT_PET_SETTINGS.randomIdleEnabled
        : Boolean(raw.randomIdleEnabled),
  };
}

function normalizeProfiles(
  raw: Partial<PetSettings> | null | undefined,
  modelKind: PetModelKind
): PetModelProfiles {
  const defaults = createDefaultProfiles();
  const incoming = (raw?.profiles ?? {}) as Partial<
    Record<PetModelKind, Partial<PetModelProfile>>
  >;
  const hasProfiles =
    raw?.profiles &&
    typeof raw.profiles === "object" &&
    Object.keys(raw.profiles as object).length > 0;

  const next = { ...defaults };
  for (const kind of PET_MODEL_KINDS) {
    next[kind] = normalizeOneProfile(kind, incoming[kind]);
  }

  if (!hasProfiles) {
    const shared = legacySharedFallbacks(raw);
    next[modelKind] = normalizeOneProfile(
      modelKind,
      {
        nickname: typeof raw?.nickname === "string" ? raw.nickname : "",
        personality: isPetPersonality(raw?.personality)
          ? raw.personality
          : undefined,
        tone:
          raw?.tone === "snarky" || raw?.tone === "cute" ? raw.tone : undefined,
        themeId: typeof raw?.themeId === "string" ? raw.themeId : undefined,
        zoomPercent:
          raw?.zoomPercent === undefined ? undefined : Number(raw.zoomPercent),
        demoMotion:
          typeof raw?.demoMotion === "string" ? raw.demoMotion : undefined,
        muted: raw?.muted,
        opacity: raw?.opacity,
        usbWatchEnabled: raw?.usbWatchEnabled,
        randomIdleEnabled: raw?.randomIdleEnabled,
      },
      shared
    );
  }

  return next;
}

function applyActiveProfile(
  modelKind: PetModelKind,
  profiles: PetModelProfiles
): Pick<
  PetSettings,
  | "tone"
  | "demoMotion"
  | "themeId"
  | "nickname"
  | "personality"
  | "zoomPercent"
  | "muted"
  | "opacity"
  | "usbWatchEnabled"
  | "randomIdleEnabled"
> {
  const p = profiles[modelKind] ?? defaultProfileForModel(modelKind);
  return {
    tone: p.tone,
    demoMotion: p.demoMotion,
    themeId: p.themeId,
    nickname: p.nickname,
    personality: p.personality,
    zoomPercent: p.zoomPercent,
    muted: p.muted,
    opacity: p.opacity,
    usbWatchEnabled: p.usbWatchEnabled,
    randomIdleEnabled: p.randomIdleEnabled,
  };
}

export function normalizePetSettings(
  raw: Partial<PetSettings> | null | undefined
): PetSettings {
  const modelKind = isPetModelKind(raw?.modelKind)
    ? raw.modelKind
    : DEFAULT_PET_MODEL;
  const profiles = normalizeProfiles(raw, modelKind);
  const active = applyActiveProfile(modelKind, profiles);

  return {
    enabled: Boolean(raw?.enabled),
    modelKind,
    vrmModelName:
      typeof raw?.vrmModelName === "string" ? raw.vrmModelName.trim() : "",
    vrmModelRev: Math.max(
      0,
      Math.floor(
        Number(raw?.vrmModelRev ?? DEFAULT_PET_SETTINGS.vrmModelRev) || 0
      )
    ),
    hitBoundsEnabled:
      raw?.hitBoundsEnabled === undefined
        ? DEFAULT_PET_SETTINGS.hitBoundsEnabled
        : Boolean(raw.hitBoundsEnabled),
    profiles,
    ...active,
  };
}

export function syncActiveProfileIntoProfiles(
  settings: PetSettings
): PetSettings {
  const model = settings.modelKind;
  const profiles: PetModelProfiles = {
    ...settings.profiles,
    [model]: normalizeOneProfile(model, {
      nickname: settings.nickname,
      personality: settings.personality,
      tone: settings.tone,
      themeId: settings.themeId,
      zoomPercent: settings.zoomPercent,
      demoMotion: settings.demoMotion,
      muted: settings.muted,
      opacity: settings.opacity,
      usbWatchEnabled: settings.usbWatchEnabled,
      randomIdleEnabled: settings.randomIdleEnabled,
    }),
  };
  return normalizePetSettings({ ...settings, profiles });
}

export function switchPetModel(
  settings: PetSettings,
  nextModel: PetModelKind,
  fromModel?: PetModelKind
): PetSettings {
  const prev = fromModel ?? settings.modelKind;
  const withPrev: PetSettings = { ...settings, modelKind: prev };
  const saved = syncActiveProfileIntoProfiles(withPrev);
  if (prev === nextModel) return saved;
  const profiles = saved.profiles;
  const active = applyActiveProfile(nextModel, profiles);
  return normalizePetSettings({
    ...saved,
    modelKind: nextModel,
    profiles,
    ...active,
  });
}

export function resetActiveModelProfile(settings: PetSettings): PetSettings {
  const model = settings.modelKind;
  const profiles: PetModelProfiles = {
    ...settings.profiles,
    [model]: defaultProfileForModel(model),
  };
  return normalizePetSettings({
    ...settings,
    profiles,
    ...applyActiveProfile(model, profiles),
  });
}

export function loadPetSettings(): PetSettings {
  try {
    const raw = localStorage.getItem(PET_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_PET_SETTINGS, profiles: createDefaultProfiles() };
    return normalizePetSettings(JSON.parse(raw) as Partial<PetSettings>);
  } catch {
    return { ...DEFAULT_PET_SETTINGS, profiles: createDefaultProfiles() };
  }
}

export function savePetSettings(settings: PetSettings): PetSettings {
  const next = syncActiveProfileIntoProfiles(settings);
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
