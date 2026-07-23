import type { PetModelKind } from "./types";

export interface PetFormDef {
  model: PetModelKind;
  nameKey: string;
  defaultNickname?: string;
  intro: {
    zh: { cute: string; snarky: string };
    en: { cute: string; snarky: string };
  };
}

export const formChip: PetFormDef = {
  model: "chip",
  nameKey: "pet.modelChip",
  intro: {
    zh: {
      cute: "嘀——我是{name}，你的桌面芯宠，硅基心跳已同步！",
      snarky: "我是{name}。别指望我会写分区表，但可以陪你优雅翻车。",
    },
    en: {
      cute: "Beep — I'm {name}, your desktop chip pet. Heartbeat synced!",
      snarky: "Name's {name}. I won't write your CSV, but I'll watch you brick.",
    },
  },
};

export const formFig: PetFormDef = {
  model: "fig-sci",
  nameKey: "pet.modelFig",
  defaultNickname: "梨宝",
  intro: {
    zh: {
      cute: "呀哈～我是{name}，你的桌面梨宝。记得喝水、眨眼、偶尔站起来哦！",
      snarky: "我是{name}。脸可以很可爱，提醒你休息这件事我很认真。",
    },
    en: {
      cute: "Hiya~ I'm {name}, your desktop Li Bao. Drink water, blink, stretch!",
      snarky: "I'm {name}. Cute face, serious about your breaks.",
    },
  },
};

export const formToon: PetFormDef = {
  model: "toon",
  nameKey: "pet.modelToon",
  defaultNickname: "小灵",
  intro: {
    zh: {
      cute: "嗷呜～我是{name}，桌面狐火小灵宠！蹦蹦跳跳陪你写代码。",
      snarky: "我是{name}。像素虽小，监督你喝水休息可不含糊。",
    },
    en: {
      cute: "Awoo~ I'm {name}, your pixel foxfire spirit. Hop hop!",
      snarky: "I'm {name}. Tiny pixels, serious about your breaks.",
    },
  },
};

export const formVrm: PetFormDef = {
  model: "vrm",
  nameKey: "pet.modelVrm",
  defaultNickname: "乐心",
  intro: {
    zh: {
      cute: "嗯……我是{name}。我会安静陪在你身边，写代码也不孤单。",
      snarky: "我是{name}。催你休息的时候，也会尽量温柔一点。",
    },
    en: {
      cute: "Hi… I'm {name}. I'll stay quietly by your side while you code.",
      snarky: "I'm {name}. When I nudge you to rest, I'll try to be gentle.",
    },
  },
};

export const PET_FORM_REGISTRY: PetFormDef[] = [
  formChip,
  formFig,
  formToon,
  formVrm,
];

export const DEFAULT_PET_MODEL: PetModelKind = "chip";

const formByModel = new Map(PET_FORM_REGISTRY.map((f) => [f.model, f]));

export function listPetForms(): PetFormDef[] {
  return PET_FORM_REGISTRY.slice();
}

export function getPetForm(model: PetModelKind | null | undefined): PetFormDef {
  if (model && formByModel.has(model)) return formByModel.get(model)!;
  return formByModel.get(DEFAULT_PET_MODEL) ?? PET_FORM_REGISTRY[0]!;
}

export function isPetModelKind(value: unknown): value is PetModelKind {
  return (
    value === "chip" ||
    value === "fig-sci" ||
    value === "toon" ||
    value === "vrm"
  );
}
