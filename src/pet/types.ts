import type { PetModelKind } from "./skins/types";
import { DEFAULT_PET_MODEL, DEFAULT_PET_THEME_ID } from "./skins";
import type { PetPersonality } from "./personality";

export type PetTone = "cute" | "snarky";

export type PetMood =
  | "idle"
  | "happy"
  | "grumpy"
  | "curious"
  | "excited"
  | "sleep";

export interface PetModelProfile {
  nickname: string;
  personality: PetPersonality;
  tone: PetTone;
  themeId: string;
  zoomPercent: number;
  demoMotion: string;
  muted: boolean;
  opacity: number;
  usbWatchEnabled: boolean;
  randomIdleEnabled: boolean;
}

export type PetModelProfiles = Record<PetModelKind, PetModelProfile>;

export interface PetSettings {
  enabled: boolean;
  modelKind: PetModelKind;
  vrmModelName: string;
  vrmModelRev: number;
  hitBoundsEnabled: boolean;
  profiles: PetModelProfiles;
  muted: boolean;
  opacity: number;
  usbWatchEnabled: boolean;
  randomIdleEnabled: boolean;
  tone: PetTone;
  demoMotion: string;
  themeId: string;
  nickname: string;
  personality: PetPersonality;
  zoomPercent: number;
}

export const PET_WINDOW_LABEL = "pet";
export const PET_SETTINGS_KEY = "wheat-esp-pet-settings";
export const PET_SETTINGS_EVENT = "pet://settings-changed";
export const PET_INTRO_EVENT = "pet://intro";

export const PET_MODEL_KINDS: PetModelKind[] = [
  "chip",
  "fig-sci",
  "toon",
  "vrm",
];

export function defaultProfileForModel(model: PetModelKind): PetModelProfile {
  const demoMotion =
    model === "fig-sci"
      ? "happy-bounce"
      : model === "toon"
        ? "toon-sway"
        : model === "vrm"
          ? "happy-bounce"
          : "screen-dash";
  const themeId = model === "fig-sci" ? "sunny" : DEFAULT_PET_THEME_ID;
  return {
    nickname: "",
    personality: "sunny",
    tone: "cute",
    themeId,
    zoomPercent: 0,
    demoMotion,
    muted: false,
    opacity: 1,
    usbWatchEnabled: true,
    randomIdleEnabled: true,
  };
}

export function createDefaultProfiles(): PetModelProfiles {
  return {
    chip: defaultProfileForModel("chip"),
    "fig-sci": defaultProfileForModel("fig-sci"),
    toon: defaultProfileForModel("toon"),
    vrm: defaultProfileForModel("vrm"),
  };
}

export const DEFAULT_PET_SETTINGS: PetSettings = {
  enabled: false,
  muted: false,
  opacity: 1,
  modelKind: DEFAULT_PET_MODEL,
  usbWatchEnabled: true,
  randomIdleEnabled: true,
  vrmModelName: "",
  vrmModelRev: 0,
  hitBoundsEnabled: true,
  profiles: createDefaultProfiles(),
  tone: "cute",
  demoMotion: "screen-dash",
  themeId: DEFAULT_PET_THEME_ID,
  nickname: "",
  personality: "sunny",
  zoomPercent: 0,
};

export interface PetUsbAnnouncePayload {
  ports: Array<{
    portName: string;
    friendlyName?: string | null;
    description?: string | null;
  }>;
  added: string[];
}
