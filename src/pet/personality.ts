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
  return text
    .replace(/[～~!！。.…呢嘛呀哦啦吧啊哼切欸喂]+$/u, "")
    .trimEnd();
}

export const PERSONALITY_LINES_ZH: Record<PetPersonality, string[]> = {
  sunny: [
    "嘿嘿，今天也要一起加油呀！",
    "看到你我就开心！需要我陪着吗？",
    "来来来，打起精神，我给你加油打气～",
    "失败也没关系啦，我们再试一次就好！",
    "你认真的样子超酷的！我先记小本本～",
    "休息一下嘛～喝口水，笑一个！",
    "有我在就不孤单哦，桌面小太阳上线！",
  ],
  shy: [
    "那个……我、我只是想轻轻提醒一下……",
    "嗯……如果你不忙的话……要不要歇一会儿……",
    "对、对不起，是不是吵到你了……",
    "我……我在这儿陪着你……不会乱跑的……",
    "喝、喝口水好不好……我就说这一句……",
    "你要是累了……告诉我也可以的……",
    "……眼神对上了。我、我先低头。",
  ],
  cool: [
    "提醒完毕。其余自理。",
    "效率优先。情绪稍后处理。",
    "已记录。不必解释。",
    "休息是策略，不是软弱。",
    "状态不佳。建议暂停三分钟。",
    "……哼。还算清楚。",
    "话说完了。继续吧。",
  ],
  fiery: [
    "喂！别装听不见！先眨眼！",
    "哈？还坐着？腿废了算我输！",
    "喝水！现在！别跟我讨价还价！",
    "切，又硬撑？日志都比你诚实！",
    "烦死了，再熬我就吵到你耳旁！",
    "成功了也别飘，先把腰直起来！",
    "喂喂喂，眼睛要冒烟了知不知道！",
  ],
};

export const PERSONALITY_LINES_EN: Record<PetPersonality, string[]> = {
  sunny: [
    "Hehe—let's crush it together!",
    "I'm your pocket sunshine. Need a boost?",
    "Fail once? We bounce back—promise!",
    "Smile check! Pass. Carry on~",
  ],
  shy: [
    "Um... just a tiny reminder...",
    "S-sorry if I'm interrupting...",
    "I-I'll stay quiet... and stay here...",
    "Maybe... a sip of water...?",
  ],
  cool: [
    "Noted. Proceed.",
    "Efficiency first. Feelings later.",
    "Break: three minutes. Non-negotiable.",
    "Hmph. Adequate.",
  ],
  fiery: [
    "Hey! Blink. Now.",
    "Still sitting?! Legs aren't decoration!",
    "Drink water. Argue later.",
    "Tch—stop playing tough guy!",
  ],
};

const ZH_END: Record<PetPersonality, string[]> = {
  sunny: ["～", "！", "呀～", "哦！", "嘿！", "耶！"],
  shy: ["……", "呢……", "嘛……", "……啦", "呢", "……好吗"],
  cool: ["。", "……", "。", "罢了。", "即可。"],
  fiery: ["！", "啊？！", "哼！", "！切。", "烦死了！", "听见没！"],
};

const ZH_PREFIX: Record<PetPersonality, string[]> = {
  sunny: ["", "嘿嘿，", "呀，", "好耶，", ""],
  shy: ["", "那个……", "嗯……", "对、对不起，", "我……"],
  cool: ["", "……", "呵，", "行吧，", ""],
  fiery: ["", "喂，", "哈？", "啧，", "说你呢，"],
};

const EN_END: Record<PetPersonality, string[]> = {
  sunny: ["!", "~", "!!", "!"],
  shy: ["...", "...", "~", "..."],
  cool: [".", "...", ".", "."],
  fiery: ["!", "?!", " Hmph!", "!", "—now!"],
};

const EN_PREFIX: Record<PetPersonality, string[]> = {
  sunny: ["", "Hehe, ", "Yay— ", ""],
  shy: ["", "Um... ", "I... ", ""],
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
    if (personality === "cool" && base.length > 18 && Math.random() < 0.35) {
      return `${prefix}${base.slice(0, 14)}……${end}`;
    }
    if (personality === "fiery" && Math.random() < 0.25) {
      return `${prefix}${base}${end}听见没！`;
    }
    if (personality === "shy" && Math.random() < 0.3) {
      return `${prefix}${base}……就这样。`;
    }
    return `${prefix}${base}${end}`;
  }

  const prefix = pick(EN_PREFIX[personality]);
  const end = pick(EN_END[personality]);
  return `${prefix}${base}${end}`;
}

export function pickPersonalityLine(
  personality: PetPersonality,
  lang: "zh" | "en" = "zh"
): string {
  const pool =
    lang === "zh"
      ? PERSONALITY_LINES_ZH[personality]
      : PERSONALITY_LINES_EN[personality];
  return pick(pool);
}
