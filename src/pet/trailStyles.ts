import type { PetModelKind } from "./skins/types";
import type { PetToonDecorId } from "./skins/themes";

export type TrailParticleShape = "dot" | "cross" | "spark" | "diamond";

/** 拖尾视觉预设：按形象（非角色）区分 */
export interface PetTrailStyle {
  id: string;
  /** 焰头高光 */
  head: string;
  /** 核心主色 */
  core: string;
  /** 中段 */
  mid: string;
  /** 尾端淡色 */
  soft: string;
  /** 外发光 */
  glow: string;
  /** 地面光影 */
  ground: string;
  shapes: TrailParticleShape[];
  /** 发射密度倍率 */
  density: number;
  /** 扇形发散（弧度） */
  fan: number;
  /** 粒子寿命 ms */
  lifeMs: [number, number];
  /** 彗星头长度倍率 */
  headScale: number;
  /** 是否彩虹渐变（星月灵） */
  iridescent?: boolean;
}

const crystal: PetTrailStyle = {
  id: "crystal",
  head: "#f0ffff",
  core: "#00e5ff",
  mid: "#3ec8ff",
  soft: "#7eefff",
  glow: "rgba(0, 229, 255, 0.32)",
  ground: "rgba(0, 229, 255, 0.18)",
  shapes: ["cross", "dot", "spark"],
  density: 0.72,
  fan: 0.42,
  lifeMs: [380, 980],
  headScale: 1.7,
};

const lantern: PetTrailStyle = {
  id: "lantern",
  head: "#fff8e8",
  core: "#ffb020",
  mid: "#ff8a1a",
  soft: "#ffd078",
  glow: "rgba(255, 176, 32, 0.34)",
  ground: "rgba(255, 160, 40, 0.16)",
  shapes: ["dot", "spark", "diamond"],
  density: 0.78,
  fan: 0.38,
  lifeMs: [400, 1020],
  headScale: 1.8,
};

const blossom: PetTrailStyle = {
  id: "blossom",
  head: "#fff0f6",
  core: "#ff7ab8",
  mid: "#ff5a9e",
  soft: "#ffc0de",
  glow: "rgba(255, 122, 184, 0.3)",
  ground: "rgba(255, 122, 184, 0.15)",
  shapes: ["diamond", "dot", "cross"],
  density: 0.7,
  fan: 0.48,
  lifeMs: [360, 960],
  headScale: 1.65,
};

const star: PetTrailStyle = {
  id: "star",
  head: "#ffffff",
  core: "#7cf0ff",
  mid: "#c4a0ff",
  soft: "#ffb8e0",
  glow: "rgba(180, 160, 255, 0.3)",
  ground: "rgba(200, 160, 255, 0.15)",
  shapes: ["cross", "spark", "diamond", "dot"],
  density: 0.74,
  fan: 0.46,
  lifeMs: [380, 1000],
  headScale: 1.75,
  iridescent: true,
};

const byDecor: Record<PetToonDecorId, PetTrailStyle> = {
  crystal,
  lantern,
  blossom,
  star,
};

const byThemeId: Record<string, PetTrailStyle> = {
  cyan: crystal,
  amber: lantern,
  rose: blossom,
  violet: star,
};

/** 根据当前形象解析拖尾风格（芯宝 / 灵宠共用主题色系） */
export function resolveTrailStyle(options: {
  themeId: string;
  model: PetModelKind;
  toonDecor?: PetToonDecorId | null;
}): PetTrailStyle {
  if (options.model === "toon" && options.toonDecor) {
    return byDecor[options.toonDecor] ?? crystal;
  }
  return byThemeId[options.themeId] ?? crystal;
}
