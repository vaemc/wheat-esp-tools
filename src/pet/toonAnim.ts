/**
 * 灵宠（像素神话兽）动作状态
 */
import type { PetIdleMotion } from "./motions";

export type ToonAnimState =
  | "idle"
  | "walk"
  | "wave"
  | "happy"
  | "peek"
  | "sleep"
  | "read"
  | "tea"
  | "tilt"
  | "sway"
  | "water"
  | "grass"
  | "fire"
  | "splash"
  | "thunder"
  | "dodge"
  | "wormhole";

export function resolveToonAnimState(
  motion: PetIdleMotion | undefined,
  mood: string
): ToonAnimState {
  if (mood === "sleep") return "sleep";
  switch (motion) {
    case "toon-walk":
    case "tip-toe":
    case "side-hop":
      return "walk";
    case "toon-wave":
      return "wave";
    case "toon-read":
    case "bow-nod":
      return "read";
    case "toon-tea":
    case "stretch-up":
      return "tea";
    case "toon-tilt":
      return "tilt";
    case "toon-sway":
    case "toon-spin": // 旧「原地打转」兼容 → 轻晃
    case "sway-step":
      return "sway";
    case "toon-water":
      return "water";
    case "toon-grass":
      return "grass";
    case "toon-fire":
      return "fire";
    case "toon-splash":
      return "splash";
    case "toon-thunder":
      return "thunder";
    case "toon-dodge":
      return "dodge";
    case "screen-wormhole":
    case "screen-dash":
    case "screen-hop":
    case "screen-glide":
    case "screen-zip":
      return "wormhole";
    case "happy-bounce":
    case "victory-burst":
    case "rocket-jump":
    case "tap-frenzy":
      return "happy";
    case "peekaboo":
      return "peek";
    default:
      return "idle";
  }
}
