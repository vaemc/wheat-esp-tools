import type { PetIdleMotion } from "./motions";
import type { PetMood } from "./types";

/** Euler XYZ in radians，相对 VRM normalized T-pose */
export type BoneEuler = { x?: number; y?: number; z?: number };

export type VrmBoneName =
  | "hips"
  | "spine"
  | "chest"
  | "upperChest"
  | "neck"
  | "head"
  | "leftShoulder"
  | "rightShoulder"
  | "leftUpperArm"
  | "leftLowerArm"
  | "leftHand"
  | "rightUpperArm"
  | "rightLowerArm"
  | "rightHand"
  | "leftUpperLeg"
  | "leftLowerLeg"
  | "rightUpperLeg"
  | "rightLowerLeg";

export type VrmPoseMap = Partial<Record<VrmBoneName, BoneEuler>>;

export interface VrmPoseFrame {
  bones: VrmPoseMap;
  rootY?: number;
  rootYaw?: number;
}

const FWD = -1;

const ZL = Math.PI * 0.34;
const ZR = -Math.PI * 0.34;

function e(x = 0, y = 0, z = 0): BoneEuler {
  return { x, y, z };
}

function mergePose(...parts: VrmPoseMap[]): VrmPoseMap {
  const out: VrmPoseMap = {};
  for (const p of parts) {
    for (const [k, v] of Object.entries(p)) {
      const key = k as VrmBoneName;
      out[key] = { x: 0, y: 0, z: 0, ...out[key], ...v };
    }
  }
  return out;
}

function restArms(opts?: { swingL?: number; swingR?: number }): VrmPoseMap {
  const sL = opts?.swingL ?? 0;
  const sR = opts?.swingR ?? 0;
  return {
    leftShoulder: e(0.06, 0.12, 0.22),
    rightShoulder: e(0.06, -0.12, -0.22),
    leftUpperArm: e(0.06 + sL, 0.28, ZL + 0.18),
    leftLowerArm: e(0.62 + Math.max(0, -sL) * 0.4, 0.12, 0.22),
    leftHand: e(0.12, 0.06, 0.08),
    rightUpperArm: e(0.06 + sR, -0.28, ZR - 0.18),
    rightLowerArm: e(0.62 + Math.max(0, -sR) * 0.4, -0.12, -0.22),
    rightHand: e(0.12, -0.06, -0.08),
  };
}

export function applySoftHeadGaze(
  pose: VrmPoseFrame,
  gaze: { x: number; y: number }
): VrmPoseFrame {
  const gx = Math.max(-1, Math.min(1, gaze.x / 2));
  const gy = Math.max(-1, Math.min(1, gaze.y / 2));
  const head = pose.bones.head || e();
  const neck = pose.bones.neck || e();
  return {
    ...pose,
    bones: {
      ...pose.bones,
      neck: {
        x: (neck.x ?? 0) + -gy * 0.09,
        y: (neck.y ?? 0) + gx * 0.12,
        z: neck.z ?? 0,
      },
      head: {
        x: (head.x ?? 0) + -gy * 0.18,
        y: (head.y ?? 0) + gx * 0.24,
        z: (head.z ?? 0) + gx * 0.03,
      },
    },
  };
}

export function poseIdle(t: number): VrmPoseFrame {
  const breath = Math.sin(t * 1.35) * 0.03;
  const sway = Math.sin(t * 0.62) * 0.035;
  const weight = Math.sin(t * 0.48) * 0.04;
  const armSway = Math.sin(t * 0.85) * 0.22;

  return {
    rootY: Math.sin(t * 1.1) * 0.004,
    rootYaw: sway * 0.3,
    bones: mergePose(
      restArms({ swingL: armSway, swingR: -armSway * 0.9 }),
      {
        hips: e(FWD * 0.02, sway * 0.4, weight * 0.18),
        spine: e(FWD * (breath * 0.65 + 0.02), sway * 0.55, 0),
        chest: e(FWD * breath * 0.4, sway * 0.35, 0),
        upperChest: e(FWD * breath * 0.2, sway * 0.12, 0),
        neck: e(FWD * (-breath * 0.12), sway * 0.15, 0),
        head: e(0.02 + Math.sin(t * 0.8) * 0.02, sway * 0.12, Math.sin(t * 0.65) * 0.025),
        leftUpperLeg: e(-0.03 + weight * 0.04, 0, 0.03),
        rightUpperLeg: e(-0.03 - weight * 0.04, 0, -0.03),
        leftLowerLeg: e(0.05),
        rightLowerLeg: e(0.05),
      }
    ),
  };
}

export function poseWalk(t: number): VrmPoseFrame {
  const g = t * 4.0;
  const swing = Math.sin(g);
  const opp = Math.sin(g + Math.PI);
  const harm = Math.sin(g * 2) * 0.1;
  const bob = Math.abs(Math.sin(g)) * 0.01;

  const armAmp = 0.36;
  const lUpper = 0.08 + opp * armAmp + harm * 0.06;
  const rUpper = 0.08 + swing * armAmp - harm * 0.06;
  const lElbow = 0.5 + Math.max(0, -opp) * 0.38 + Math.max(0, opp) * 0.08;
  const rElbow = 0.5 + Math.max(0, -swing) * 0.38 + Math.max(0, swing) * 0.08;
  const legAmp = 0.32;

  return {
    rootY: bob,
    rootYaw: swing * 0.04,
    bones: mergePose({
      hips: e(FWD * 0.03, swing * 0.08, swing * 0.02),
      spine: e(FWD * 0.02, swing * 0.06, 0),
      chest: e(FWD * 0.01, swing * 0.05, 0),
      upperChest: e(0, swing * 0.025, 0),
      neck: e(0.02, -swing * 0.03, 0),
      head: e(0.03, -swing * 0.04, 0),
      leftShoulder: e(0.05, 0.1, 0.18),
      rightShoulder: e(0.05, -0.1, -0.18),
      leftUpperArm: e(lUpper, 0.24, ZL + 0.14),
      leftLowerArm: e(lElbow, 0.1, 0.18),
      leftHand: e(0.08, 0, opp * 0.05),
      rightUpperArm: e(rUpper, -0.24, ZR - 0.14),
      rightLowerArm: e(rElbow, -0.1, -0.18),
      rightHand: e(0.08, 0, swing * 0.05),
      leftUpperLeg: e(swing * legAmp - 0.02, 0, 0.02),
      leftLowerLeg: e(0.1 + Math.max(0, -swing) * 0.5),
      rightUpperLeg: e(opp * legAmp - 0.02, 0, -0.02),
      rightLowerLeg: e(0.1 + Math.max(0, -opp) * 0.5),
    }),
  };
}

export function poseLifted(t: number): VrmPoseFrame {
  const d1 = Math.sin(t * 5.0) * 0.14;
  const d2 = Math.sin(t * 5.0 + 1.2) * 0.12;
  return {
    rootY: 0.05,
    rootYaw: Math.sin(t * 2.2) * 0.035,
    bones: mergePose(restArms({ swingL: d1 * 0.25, swingR: d2 * 0.25 }), {
      hips: e(FWD * 0.06, 0, 0),
      spine: e(FWD * 0.05, 0, 0),
      chest: e(FWD * 0.03, 0, 0),
      upperChest: e(FWD * 0.015, 0, 0),
      neck: e(FWD * 0.08, Math.sin(t * 2) * 0.06, 0),
      head: e(FWD * 0.12 + Math.sin(t * 2.5) * 0.03, Math.sin(t * 1.6) * 0.08, 0),
      leftShoulder: e(0.05, 0.1, 0.2),
      rightShoulder: e(0.05, -0.1, -0.2),
      leftUpperLeg: e(0.22 + d1 * 0.5, 0.04, 0.07),
      leftLowerLeg: e(0.5 + Math.max(0, d1) * 0.4),
      rightUpperLeg: e(0.2 + d2 * 0.5, -0.04, -0.07),
      rightLowerLeg: e(0.48 + Math.max(0, d2) * 0.4),
    }),
  };
}

export function poseHappy(t: number): VrmPoseFrame {
  const hop = Math.abs(Math.sin(t * 5.6));
  const pump = Math.sin(t * 5.6);
  return {
    rootY: hop * 0.04,
    bones: mergePose(restArms(), {
      hips: e(FWD * 0.08, 0, 0),
      spine: e(FWD * 0.06, 0, 0),
      chest: e(FWD * 0.04, 0, 0),
      neck: e(FWD * -0.04, 0, 0),
      head: e(FWD * -0.06, Math.sin(t * 3.5) * 0.08, pump * 0.04),
      leftShoulder: e(0.08, 0.28, 0.18),
      rightShoulder: e(0.08, -0.28, -0.18),
      leftUpperArm: e(0.4, 0.55, 0.28 + pump * 0.12),
      rightUpperArm: e(0.4, -0.55, -0.28 - pump * 0.12),
      leftLowerArm: e(0.45, 0.1, 0.12),
      rightLowerArm: e(0.45, -0.1, -0.12),
      leftUpperLeg: e(-0.06 + hop * 0.08),
      rightUpperLeg: e(-0.06 + hop * 0.08),
      leftLowerLeg: e(0.12),
      rightLowerLeg: e(0.12),
    }),
  };
}

export function poseBow(t: number): VrmPoseFrame {
  const nod = 0.5 + Math.sin(t * 2.2) * 0.08;
  return {
    rootY: -0.02,
    bones: mergePose(restArms({ swingL: 0.05, swingR: 0.05 }), {
      hips: e(FWD * 0.22 * nod, 0, 0),
      spine: e(FWD * 0.48 * nod, 0, 0),
      chest: e(FWD * 0.28 * nod, 0, 0),
      upperChest: e(FWD * 0.12 * nod, 0, 0),
      neck: e(FWD * 0.22 * nod, 0, 0),
      head: e(FWD * 0.35 * nod, 0, 0),
      leftUpperArm: e(0.15, 0.2, ZL + 0.1),
      rightUpperArm: e(0.15, -0.2, ZR - 0.1),
      leftLowerArm: e(0.45, 0.1, 0.18),
      rightLowerArm: e(0.45, -0.1, -0.18),
    }),
  };
}

export function poseSway(t: number): VrmPoseFrame {
  const s = Math.sin(t * 1.65);
  return {
    rootY: Math.abs(s) * 0.007,
    rootYaw: s * 0.12,
    bones: mergePose(
      restArms({ swingL: s * 0.4, swingR: s * 0.4 }),
      {
        hips: e(FWD * 0.02, s * 0.09, s * 0.025),
        spine: e(FWD * 0.02, s * 0.14, 0),
        chest: e(0, s * 0.1, 0),
        neck: e(0.02, s * 0.07, 0),
        head: e(0.03, s * 0.15, -s * 0.04),
        leftUpperLeg: e(-0.04 + s * 0.09, 0, 0.03),
        rightUpperLeg: e(-0.04 - s * 0.09, 0, -0.03),
        leftLowerLeg: e(0.07),
        rightLowerLeg: e(0.07),
      }
    ),
  };
}

export function poseSleep(_t: number): VrmPoseFrame {
  return {
    rootY: -0.01,
    bones: mergePose(restArms(), {
      hips: e(FWD * 0.05, 0, 0.05),
      spine: e(FWD * 0.12, 0, 0.08),
      chest: e(FWD * 0.08),
      neck: e(FWD * 0.25, 0, 0.18),
      head: e(FWD * 0.4, 0, 0.3),
      leftUpperArm: e(0.22, 0.22, ZL + 0.18),
      rightUpperArm: e(0.22, -0.22, ZR - 0.18),
      leftLowerArm: e(0.55, 0.1, 0.18),
      rightLowerArm: e(0.55, -0.1, -0.18),
    }),
  };
}

export function resolveVrmPose(
  motion: PetIdleMotion | undefined,
  mood: PetMood,
  t: number,
  options?: { lifting?: boolean; gaze?: { x: number; y: number } }
): VrmPoseFrame {
  let pose: VrmPoseFrame;
  if (options?.lifting) {
    pose = poseLifted(t);
  } else if (mood === "sleep") {
    pose = poseSleep(t);
  } else {
    switch (motion) {
      case "vrm-walk":
      case "toon-walk":
      case "screen-glide":
      case "screen-dash":
      case "screen-hop":
      case "screen-zip":
        pose = poseWalk(t);
        break;
      case "happy-bounce":
      case "tap-frenzy":
        pose = poseHappy(t);
        break;
      case "bow-nod":
        pose = poseBow(t);
        break;
      case "sway-step":
      case "side-hop":
      case "tip-toe":
        pose = poseSway(t);
        break;
      case "peekaboo":
      case "victory-burst":
      case "stretch-up":
        pose = motion === "stretch-up" ? poseHappy(t * 0.5) : poseIdle(t);
        break;
      default:
        pose = poseIdle(t);
    }
  }

  if (options?.gaze && !options.lifting && mood !== "sleep") {
    return applySoftHeadGaze(pose, options.gaze);
  }
  return pose;
}
