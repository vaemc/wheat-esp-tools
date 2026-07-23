export type PetIdleMotion =
  | "idle-float"
  | "happy-bounce"
  | "fly-orbit"
  | "fly-dash"
  | "barrel-roll"
  | "rocket-jump"
  | "cartwheel"
  | "figure-eight"
  | "victory-burst"
  | "peekaboo"
  | "sway-step"
  | "side-hop"
  | "bow-nod"
  | "stretch-up"
  | "tip-toe"
  | "screen-dash"
  | "screen-hop"
  | "screen-glide"
  | "screen-zip"
  | "screen-wormhole"
  | "tap-frenzy"
  | "toon-walk"
  | "toon-wave"
  /** @deprecated 旧「原地打转」；解析时映射为 toon-sway */
  | "toon-spin"
  | "toon-read"
  | "toon-tea"
  | "toon-tilt"
  | "toon-sway"
  | "toon-water"
  | "toon-grass"
  | "toon-fire"
  | "toon-splash"
  | "toon-thunder"
  | "toon-dodge"
  | "vrm-walk";

export type PetModelMotionKind = "chip" | "fig-sci" | "toon" | "vrm";

export const PET_CHIP_DEMO_MOTIONS: PetIdleMotion[] = [
  "screen-dash",
  "screen-hop",
  "screen-glide",
  "screen-zip",
  "fly-dash",
  "fly-orbit",
  "figure-eight",
  "barrel-roll",
  "victory-burst",
  "peekaboo",
];

export const PET_FIG_DEMO_MOTIONS: PetIdleMotion[] = [
  "happy-bounce",
  "sway-step",
  "side-hop",
  "tip-toe",
  "bow-nod",
  "stretch-up",
  "rocket-jump",
  "victory-burst",
  "peekaboo",
  "screen-glide",
];

export const PET_TOON_DEMO_MOTIONS: PetIdleMotion[] = [
  "toon-grass",
  "toon-thunder",
  "toon-walk",
  "toon-tilt",
  "toon-sway",
  "happy-bounce",
  "peekaboo",
  "screen-wormhole",
];

export const PET_VRM_DEMO_MOTIONS: PetIdleMotion[] = [
  "idle-float",
  "happy-bounce",
  "sway-step",
  "bow-nod",
  "vrm-walk",
];

export function demoMotionsForModel(
  model: PetModelMotionKind
): PetIdleMotion[] {
  if (model === "fig-sci") return PET_FIG_DEMO_MOTIONS;
  if (model === "toon") return PET_TOON_DEMO_MOTIONS;
  if (model === "vrm") return PET_VRM_DEMO_MOTIONS;
  return PET_CHIP_DEMO_MOTIONS;
}

export function idleMotionPoolForModel(
  model: PetModelMotionKind
): PetIdleMotion[] {
  if (model === "fig-sci") {
    return [
      "sway-step",
      "side-hop",
      "tip-toe",
      "bow-nod",
      "stretch-up",
      "happy-bounce",
      "screen-glide",
      "victory-burst",
      "peekaboo",
    ];
  }
  if (model === "toon") {
    return [
      "toon-grass",
      "toon-thunder",
      "toon-walk",
      "toon-tilt",
      "toon-sway",
      "happy-bounce",
      "peekaboo",
      "screen-wormhole",
      "screen-wormhole",
    ];
  }
  if (model === "vrm") {
    return [
      "idle-float",
      "happy-bounce",
      "sway-step",
      "bow-nod",
      "vrm-walk",
      "vrm-walk",
    ];
  }
  return [
    "screen-dash",
    "screen-dash",
    "screen-hop",
    "screen-hop",
    "screen-glide",
    "screen-glide",
    "screen-zip",
    "screen-zip",
    "fly-dash",
    "fly-orbit",
    "figure-eight",
    "barrel-roll",
    "victory-burst",
    "peekaboo",
  ];
}

export function isScreenFlightMotion(motion: PetIdleMotion): boolean {
  return (
    motion === "screen-dash" ||
    motion === "screen-hop" ||
    motion === "screen-glide" ||
    motion === "screen-zip" ||
    motion === "screen-wormhole"
  );
}

export function isVrmWalkMotion(motion: PetIdleMotion): boolean {
  return motion === "vrm-walk";
}

export function resolveMotionForModel(
  motion: PetIdleMotion,
  model: PetModelMotionKind
): PetIdleMotion {
  if (model === "chip") {
    if (
      motion === "toon-walk" ||
      motion === "toon-wave" ||
      motion === "toon-spin" ||
      motion === "toon-read" ||
      motion === "toon-tea" ||
      motion === "toon-tilt" ||
      motion === "toon-sway" ||
      motion === "toon-water" ||
      motion === "toon-grass" ||
      motion === "toon-fire" ||
      motion === "toon-splash" ||
      motion === "toon-thunder" ||
      motion === "toon-dodge" ||
      motion === "screen-wormhole"
    ) {
      return motion === "screen-wormhole" ? "screen-zip" : "screen-dash";
    }
    return motion;
  }

  if (model === "toon") {
    switch (motion) {
      case "fly-orbit":
      case "figure-eight":
      case "toon-spin":
        return "toon-sway";
      case "fly-dash":
      case "barrel-roll":
      case "toon-wave":
      case "cartwheel":
        return "toon-walk";
      case "sway-step":
        return "toon-sway";
      case "bow-nod":
      case "toon-read":
        return "toon-tilt";
      case "stretch-up":
      case "toon-tea":
      case "toon-fire":
      case "toon-water":
      case "toon-splash":
      case "toon-dodge":
        return "toon-grass";
      case "screen-dash":
      case "screen-hop":
      case "screen-glide":
      case "screen-zip":
        return "screen-wormhole";
      default:
        return motion;
    }
  }

  if (model === "vrm") {
    switch (motion) {
      case "screen-dash":
      case "screen-hop":
      case "screen-zip":
      case "screen-glide":
      case "screen-wormhole":
      case "toon-walk":
      case "fly-dash":
      case "fly-orbit":
        return "vrm-walk";
      case "toon-wave":
      case "toon-sway":
      case "toon-spin":
        return "sway-step";
      case "toon-read":
      case "toon-tea":
      case "toon-tilt":
      case "peekaboo":
        return "bow-nod";
      case "toon-water":
      case "toon-grass":
      case "toon-fire":
      case "toon-splash":
      case "toon-thunder":
      case "toon-dodge":
      case "victory-burst":
        return "happy-bounce";
      default:
        return motion;
    }
  }

  switch (motion) {
    case "fly-orbit":
    case "figure-eight":
      return "sway-step";
    case "fly-dash":
      return "side-hop";
    case "barrel-roll":
      return "happy-bounce";
    case "cartwheel":
      return "bow-nod";
    case "toon-walk":
      return "tip-toe";
    case "toon-wave":
    case "toon-water":
      return "happy-bounce";
    case "toon-sway":
    case "toon-grass":
      return "sway-step";
    case "toon-read":
      return "bow-nod";
    case "toon-tea":
    case "toon-fire":
      return "stretch-up";
    case "toon-tilt":
    case "toon-dodge":
      return "peekaboo";
    case "toon-splash":
      return "side-hop";
    case "toon-thunder":
      return "victory-burst";
    case "screen-dash":
    case "screen-hop":
    case "screen-zip":
    case "screen-wormhole":
      return "screen-glide";
    default:
      return motion;
  }
}

export const PET_MOTION_EVENT = "pet://play-motion";
export const PET_OPEN_SETTINGS_EVENT = "pet://open-settings";

export interface PetMotionPayload {
  motion: PetIdleMotion;
}

const ALL_MOTIONS: PetIdleMotion[] = [
  ...new Set<PetIdleMotion>([
    ...PET_CHIP_DEMO_MOTIONS,
    ...PET_FIG_DEMO_MOTIONS,
    ...PET_TOON_DEMO_MOTIONS,
    ...PET_VRM_DEMO_MOTIONS,
    "idle-float",
    "happy-bounce",
    "tap-frenzy",
    "rocket-jump",
    "cartwheel",
    "toon-spin",
    "vrm-walk",
  ]),
];

export function isPetIdleMotion(value: unknown): value is PetIdleMotion {
  return typeof value === "string" && (ALL_MOTIONS as string[]).includes(value);
}

export function motionHoldMs(motion: PetIdleMotion): number {
  switch (motion) {
    case "screen-wormhole":
      return 1300;
    case "screen-dash":
    case "screen-zip":
      return 1600;
    case "screen-hop":
      return 1900;
    case "screen-glide":
      return 2200;
    case "vrm-walk":
      return 13000;
    case "fly-orbit":
    case "figure-eight":
    case "sway-step":
    case "toon-sway":
    case "toon-read":
    case "toon-tea":
    case "toon-water":
    case "toon-grass":
      return 3200;
    case "fly-dash":
    case "side-hop":
    case "tip-toe":
    case "toon-walk":
    case "toon-wave":
    case "toon-tilt":
    case "toon-fire":
    case "toon-splash":
    case "toon-thunder":
    case "toon-dodge":
      return 2600;
    case "barrel-roll":
    case "cartwheel":
    case "bow-nod":
    case "stretch-up":
      return 2400;
    case "rocket-jump":
    case "victory-burst":
    case "peekaboo":
    case "tap-frenzy":
      return 2100;
    case "happy-bounce":
      return 700;
    default:
      return 1200;
  }
}

export const PET_TAP_EGG_MOTIONS: PetIdleMotion[] = [
  "tap-frenzy",
  "screen-zip",
  "victory-burst",
  "peekaboo",
  "toon-thunder",
  "screen-wormhole",
];
