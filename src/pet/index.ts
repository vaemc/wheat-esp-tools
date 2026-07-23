export { initPetHost, syncPetWindow, openPetWindow, closePetWindow } from "./petWindow";
export {
  initPetHostBridge,
  requestOpenPetSettings,
  PET_OPEN_SETTINGS_KEY,
} from "./hostBridge";
export { loadPetSettings, publishPetSettings, patchPetSettings } from "./settings";
export {
  PET_MOTION_EVENT,
  PET_OPEN_SETTINGS_EVENT,
  type PetIdleMotion,
  type PetMotionPayload,
} from "./motions";
export { resolveNickname } from "./skins";
export type { PetSettings, PetTone, PetMood } from "./types";
export type { PetPersonality } from "./personality";
export { PET_INTRO_EVENT } from "./types";

import { PET_MOTION_EVENT, type PetIdleMotion, type PetMotionPayload } from "./motions";
import { PET_INTRO_EVENT } from "./types";

export async function requestPetMotion(motion: PetIdleMotion): Promise<void> {
  try {
    const { emit } = await import("@tauri-apps/api/event");
    const payload: PetMotionPayload = { motion };
    await emit(PET_MOTION_EVENT, payload);
  } catch {
  }
}

export async function requestPetIntro(): Promise<void> {
  try {
    const { emit } = await import("@tauri-apps/api/event");
    await emit(PET_INTRO_EVENT);
  } catch {
  }
}
