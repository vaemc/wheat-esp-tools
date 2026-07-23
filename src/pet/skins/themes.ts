import type { PetSkinVisual } from "./types";

export type PetFigArtId =
  | "sunny"
  | "shy"
  | "cool"
  | "fiery"
  | "valentine"
  | "spring"
  | "midautumn"
  | "labor";

export type PetToonDecorId = "crystal" | "lantern" | "blossom" | "star";

export interface PetThemeDef {
  id: string;
  nameKey: string;
  toonNameKey?: string;
  chipNickname: string;
  figArtId?: PetFigArtId;
  toonDecor?: PetToonDecorId;
  visual: PetSkinVisual;
}

export const themeCyan: PetThemeDef = {
  id: "cyan",
  nameKey: "pet.theme.cyan",
  toonNameKey: "pet.theme.cyanToon",
  chipNickname: "青芯",
  toonDecor: "crystal",
  visual: {
    bodyFrom: "#2a3344",
    bodyMid: "#151b26",
    bodyTo: "#0a0d14",
    dieFrom: "#1a3a4a",
    dieMid: "#0d2430",
    dieTo: "#07141c",
    accent: "#00e5ff",
    accentSoft: "#7eefff",
    packageStroke: "#3d4a5c",
    dieStroke: "#1e4d5c",
    sideHi: "#5a7a8c",
    sideMid: "#2a4050",
    sideLo: "#0a1218",
    backGrid: "rgba(0, 229, 255, 0.4)",
    mark: "ESP",
    ledHue: 185,
    skinTone: "#f4c8b4",
    hairFrom: "#1a6878",
    hairTo: "#5eefff",
  },
};

export const themeAmber: PetThemeDef = {
  id: "amber",
  nameKey: "pet.theme.amber",
  toonNameKey: "pet.theme.amberToon",
  chipNickname: "焊点",
  toonDecor: "lantern",
  visual: {
    bodyFrom: "#3a2e24",
    bodyMid: "#1c1612",
    bodyTo: "#0c0907",
    dieFrom: "#4a3018",
    dieMid: "#2a1a0c",
    dieTo: "#140c06",
    accent: "#ffb020",
    accentSoft: "#ffd078",
    packageStroke: "#6a5040",
    dieStroke: "#8a5a28",
    sideHi: "#8a6a48",
    sideMid: "#4a3420",
    sideLo: "#18100a",
    backGrid: "rgba(255, 176, 32, 0.4)",
    mark: "ENG",
    ledHue: 35,
    skinTone: "#f0c4a8",
    hairFrom: "#8a4820",
    hairTo: "#ffc060",
  },
};

export const themeRose: PetThemeDef = {
  id: "rose",
  nameKey: "pet.theme.rose",
  toonNameKey: "pet.theme.roseToon",
  chipNickname: "硅糖",
  toonDecor: "blossom",
  visual: {
    bodyFrom: "#3a2434",
    bodyMid: "#1c121a",
    bodyTo: "#0c080a",
    dieFrom: "#4a2040",
    dieMid: "#2a1230",
    dieTo: "#14081a",
    accent: "#ff7ab8",
    accentSoft: "#ffc0de",
    packageStroke: "#6a4060",
    dieStroke: "#8a4080",
    sideHi: "#8a5880",
    sideMid: "#4a2848",
    sideLo: "#180c16",
    backGrid: "rgba(255, 122, 184, 0.4)",
    mark: "SIP",
    ledHue: 330,
    skinTone: "#f8c8c0",
    hairFrom: "#a04078",
    hairTo: "#ff9ec8",
  },
};

export const themeViolet: PetThemeDef = {
  id: "violet",
  nameKey: "pet.theme.violet",
  toonNameKey: "pet.theme.violetToon",
  chipNickname: "紫晶",
  toonDecor: "star",
  visual: {
    bodyFrom: "#6b4fa0",
    bodyMid: "#5a3d8c",
    bodyTo: "#3a2468",
    dieFrom: "#c4a0ff",
    dieMid: "#8a5cd8",
    dieTo: "#4a2888",
    accent: "#7cf0ff",
    accentSoft: "#ffb8e0",
    packageStroke: "#8a70b8",
    dieStroke: "#a888d8",
    sideHi: "#b898e8",
    sideMid: "#6a4898",
    sideLo: "#2a1848",
    backGrid: "rgba(255, 184, 224, 0.35)",
    mark: "NOV",
    ledHue: 300,
    skinTone: "#f6c8b4",
    hairFrom: "#8b5cf0",
    hairTo: "#d4b8ff",
  },
};

export const themeFigSunny: PetThemeDef = {
  id: "sunny",
  nameKey: "pet.theme.sunny",
  chipNickname: "晴芯",
  figArtId: "sunny",
  visual: {
    bodyFrom: "#3a3420",
    bodyMid: "#1c1810",
    bodyTo: "#0c0a06",
    dieFrom: "#4a3818",
    dieMid: "#2a200c",
    dieTo: "#141008",
    accent: "#ffc53d",
    accentSoft: "#ffe58f",
    packageStroke: "#6a5840",
    dieStroke: "#8a6828",
    sideHi: "#8a7848",
    sideMid: "#4a4020",
    sideLo: "#181408",
    backGrid: "rgba(255, 197, 61, 0.4)",
    mark: "SUN",
    ledHue: 42,
    skinTone: "#f4c8b4",
    hairFrom: "#8a5820",
    hairTo: "#ffc53d",
  },
};

export const themeFigShy: PetThemeDef = {
  id: "shy",
  nameKey: "pet.theme.shy",
  chipNickname: "羞芯",
  figArtId: "shy",
  visual: {
    bodyFrom: "#3a2834",
    bodyMid: "#1c141a",
    bodyTo: "#0c080a",
    dieFrom: "#4a2840",
    dieMid: "#2a1830",
    dieTo: "#140c1a",
    accent: "#ff85c0",
    accentSoft: "#ffd6e7",
    packageStroke: "#6a4860",
    dieStroke: "#8a5080",
    sideHi: "#8a6080",
    sideMid: "#4a3048",
    sideLo: "#180c16",
    backGrid: "rgba(255, 133, 192, 0.4)",
    mark: "SHY",
    ledHue: 330,
    skinTone: "#f8c8c0",
    hairFrom: "#a05078",
    hairTo: "#ff85c0",
  },
};

export const themeFigCool: PetThemeDef = {
  id: "cool",
  nameKey: "pet.theme.cool",
  chipNickname: "冷芯",
  figArtId: "cool",
  visual: {
    bodyFrom: "#243038",
    bodyMid: "#12181c",
    bodyTo: "#080a0c",
    dieFrom: "#1a3848",
    dieMid: "#0d2430",
    dieTo: "#07141c",
    accent: "#40c4ff",
    accentSoft: "#9be7ff",
    packageStroke: "#3d5560",
    dieStroke: "#1e5a6c",
    sideHi: "#5a7a8c",
    sideMid: "#2a4050",
    sideLo: "#0a1218",
    backGrid: "rgba(64, 196, 255, 0.4)",
    mark: "ICE",
    ledHue: 195,
    skinTone: "#f0c8bc",
    hairFrom: "#1a6878",
    hairTo: "#40c4ff",
  },
};

export const themeFigFiery: PetThemeDef = {
  id: "fiery",
  nameKey: "pet.theme.fiery",
  chipNickname: "焰芯",
  figArtId: "fiery",
  visual: {
    bodyFrom: "#3a2218",
    bodyMid: "#1c100c",
    bodyTo: "#0c0604",
    dieFrom: "#4a2010",
    dieMid: "#2a1008",
    dieTo: "#140804",
    accent: "#ff6a1a",
    accentSoft: "#ffb080",
    packageStroke: "#6a4030",
    dieStroke: "#8a4020",
    sideHi: "#8a5040",
    sideMid: "#4a2818",
    sideLo: "#180c08",
    backGrid: "rgba(255, 106, 26, 0.4)",
    mark: "HOT",
    ledHue: 18,
    skinTone: "#f0c4a8",
    hairFrom: "#8a3018",
    hairTo: "#ff6a1a",
  },
};

export const themeValentine: PetThemeDef = {
  id: "valentine",
  nameKey: "pet.theme.valentine",
  chipNickname: "心芯",
  figArtId: "valentine",
  visual: {
    bodyFrom: "#3a1828",
    bodyMid: "#1c0c14",
    bodyTo: "#0c0608",
    dieFrom: "#5a1838",
    dieMid: "#3a1024",
    dieTo: "#1a0810",
    accent: "#ff4d7a",
    accentSoft: "#ffb0c8",
    packageStroke: "#7a3050",
    dieStroke: "#a03860",
    sideHi: "#a04868",
    sideMid: "#5a2038",
    sideLo: "#180810",
    backGrid: "rgba(255, 77, 122, 0.4)",
    mark: "LOV",
    ledHue: 340,
    skinTone: "#f8c8c0",
    hairFrom: "#5a1838",
    hairTo: "#ff6a9a",
  },
};

export const themeSpring: PetThemeDef = {
  id: "spring",
  nameKey: "pet.theme.spring",
  chipNickname: "年芯",
  figArtId: "spring",
  visual: {
    bodyFrom: "#4a1818",
    bodyMid: "#2a0c0c",
    bodyTo: "#120606",
    dieFrom: "#6a2020",
    dieMid: "#4a1010",
    dieTo: "#240808",
    accent: "#ff3b30",
    accentSoft: "#ffd060",
    packageStroke: "#8a3030",
    dieStroke: "#c04040",
    sideHi: "#b04840",
    sideMid: "#602018",
    sideLo: "#180808",
    backGrid: "rgba(255, 59, 48, 0.38)",
    mark: "CNY",
    ledHue: 8,
    skinTone: "#f4c8b4",
    hairFrom: "#6a1818",
    hairTo: "#ffd060",
  },
};

export const themeMidautumn: PetThemeDef = {
  id: "midautumn",
  nameKey: "pet.theme.midautumn",
  chipNickname: "月芯",
  figArtId: "midautumn",
  visual: {
    bodyFrom: "#2a2838",
    bodyMid: "#14121c",
    bodyTo: "#08070c",
    dieFrom: "#3a3848",
    dieMid: "#242230",
    dieTo: "#121018",
    accent: "#e8c878",
    accentSoft: "#fff0c0",
    packageStroke: "#5a5060",
    dieStroke: "#8a7890",
    sideHi: "#9088a0",
    sideMid: "#484058",
    sideLo: "#141018",
    backGrid: "rgba(232, 200, 120, 0.38)",
    mark: "MOON",
    ledHue: 45,
    skinTone: "#f6c8b4",
    hairFrom: "#3a3858",
    hairTo: "#e8c878",
  },
};

export const themeLabor: PetThemeDef = {
  id: "labor",
  nameKey: "pet.theme.labor",
  chipNickname: "工芯",
  figArtId: "labor",
  visual: {
    bodyFrom: "#2a3228",
    bodyMid: "#141810",
    bodyTo: "#080a06",
    dieFrom: "#3a4028",
    dieMid: "#222818",
    dieTo: "#10140c",
    accent: "#ff8a1a",
    accentSoft: "#ffd090",
    packageStroke: "#4a5840",
    dieStroke: "#6a7848",
    sideHi: "#788060",
    sideMid: "#3a4430",
    sideLo: "#101408",
    backGrid: "rgba(255, 138, 26, 0.4)",
    mark: "LAB",
    ledHue: 28,
    skinTone: "#f0c4a8",
    hairFrom: "#3a4820",
    hairTo: "#ff8a1a",
  },
};

export const PET_THEME_REGISTRY: PetThemeDef[] = [
  themeCyan,
  themeAmber,
  themeRose,
  themeViolet,
  themeFigSunny,
  themeFigShy,
  themeFigCool,
  themeFigFiery,
  themeValentine,
  themeSpring,
  themeMidautumn,
  themeLabor,
];

export const DEFAULT_PET_THEME_ID = themeCyan.id;
export const DEFAULT_FIG_THEME_ID = themeFigSunny.id;

const themeById = new Map(PET_THEME_REGISTRY.map((t) => [t.id, t]));

export function listPetThemes(): PetThemeDef[] {
  return PET_THEME_REGISTRY.slice();
}

export function listPetThemesForModel(
  model: "chip" | "fig-sci" | "toon" | "vrm"
): PetThemeDef[] {
  if (model === "vrm") return [];
  if (model === "fig-sci") {
    return PET_THEME_REGISTRY.filter((t) => !!t.figArtId);
  }
  return PET_THEME_REGISTRY.filter((t) => !t.figArtId);
}

export function defaultThemeIdForModel(
  model: "chip" | "fig-sci" | "toon" | "vrm"
): string {
  return model === "fig-sci" ? DEFAULT_FIG_THEME_ID : DEFAULT_PET_THEME_ID;
}

export function coerceThemeIdForModel(
  themeId: string | null | undefined,
  model: "chip" | "fig-sci" | "toon" | "vrm"
): string {
  const allowed = listPetThemesForModel(model);
  if (themeId && allowed.some((t) => t.id === themeId)) return themeId;
  return defaultThemeIdForModel(model);
}

export function getPetTheme(id: string | null | undefined): PetThemeDef {
  if (id && themeById.has(id)) return themeById.get(id)!;
  return themeById.get(DEFAULT_PET_THEME_ID) ?? PET_THEME_REGISTRY[0]!;
}

export function isPetThemeId(value: unknown): value is string {
  return typeof value === "string" && themeById.has(value);
}
