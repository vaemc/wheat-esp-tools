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

export interface PetSettings {
  enabled: boolean;
  muted: boolean;
  opacity: number;
  tone: PetTone;
  demoMotion: string;
  modelKind: PetModelKind;
  themeId: string;
  nickname: string;
  personality: PetPersonality;
  zoomPercent: number;
  usbWatchEnabled: boolean;
}

export const PET_WINDOW_LABEL = "pet";
export const PET_SETTINGS_KEY = "wheat-esp-pet-settings";
export const PET_SETTINGS_EVENT = "pet://settings-changed";
export const PET_INTRO_EVENT = "pet://intro";

export const DEFAULT_PET_SETTINGS: PetSettings = {
  enabled: false,
  muted: false,
  opacity: 1,
  tone: "cute",
  demoMotion: "screen-dash",
  modelKind: DEFAULT_PET_MODEL,
  themeId: DEFAULT_PET_THEME_ID,
  nickname: "",
  personality: "sunny",
  zoomPercent: 0,
  usbWatchEnabled: true,
};

export interface PetUsbAnnouncePayload {
  ports: Array<{
    portName: string;
    friendlyName?: string | null;
    description?: string | null;
  }>;
  added: string[];
}
