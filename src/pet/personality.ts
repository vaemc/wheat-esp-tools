export type PetPersonality = "sunny" | "shy" | "cool" | "fiery";

export const PET_PERSONALITIES: PetPersonality[] = [
  "sunny",
  "shy",
  "cool",
  "fiery",
];

export function isPetPersonality(value: unknown): value is PetPersonality {
  return (
    value === "sunny" ||
    value === "shy" ||
    value === "cool" ||
    value === "fiery"
  );
}

function stripTrailingFlavor(text: string): string {
  return text.replace(/[～~!！。.…呢嘛呀哦啦吧啊哼切]+$/u, "").trimEnd();
}

const ZH_END: Record<PetPersonality, string[]> = {
  sunny: ["～", "！", "呀～", "哦！", "嘿！"],
  shy: ["……", "呢……", "嘛～", "……啦", "呢"],
  cool: ["。", "……", "呢。", "。", "罢了。"],
  fiery: ["！", "啊？！", "哼！", "！切。", "烦死了！"],
};

const ZH_PREFIX: Record<PetPersonality, string[]> = {
  sunny: ["", "", "嘿嘿，", ""],
  shy: ["", "那个……", "", "嗯……"],
  cool: ["", "……", "呵，", ""],
  fiery: ["", "喂，", "哈？", "啧，"],
};

const EN_END: Record<PetPersonality, string[]> = {
  sunny: ["!", "~", "!", "!!"],
  shy: ["...", "...", "~", "..."],
  cool: [".", "...", ".", "."],
  fiery: ["!", "?!", " Hmph!", "!"],
};

const EN_PREFIX: Record<PetPersonality, string[]> = {
  sunny: ["", "", "Hehe, ", ""],
  shy: ["", "Um... ", "", ""],
  cool: ["", "...", "Hmph. ", ""],
  fiery: ["", "Hey— ", "What? ", "Tch. "],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function flavorPetLine(
  line: string,
  personality: PetPersonality,
  lang: "zh" | "en" = "zh"
): string {
  const base = stripTrailingFlavor(line);
  if (!base) return line;

  if (lang === "zh") {
    const prefix = pick(ZH_PREFIX[personality]);
    const end = pick(ZH_END[personality]);
    return `${prefix}${base}${end}`;
  }

  const prefix = pick(EN_PREFIX[personality]);
  const end = pick(EN_END[personality]);
  return `${prefix}${base}${end}`;
}
