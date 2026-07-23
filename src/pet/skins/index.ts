import { DEFAULT_PET_MODEL, getPetForm, isPetModelKind } from "./forms";
import {
  coerceThemeIdForModel,
  getPetTheme,
  type PetFigArtId,
  type PetToonDecorId,
} from "./themes";
import type { PetModelKind, PetSkinVisual } from "./types";

export interface PetAppearance {
  id: string;
  model: PetModelKind;
  themeId: string;
  nameKey: string;
  defaultNickname: string;
  visual: PetSkinVisual;
  figArtId?: PetFigArtId;
  toonDecor?: PetToonDecorId;
  intro: {
    zh: { cute: string; snarky: string };
    en: { cute: string; snarky: string };
  };
}

export function resolveAppearance(
  model: PetModelKind | null | undefined,
  themeId: string | null | undefined
): PetAppearance {
  const form = getPetForm(isPetModelKind(model) ? model : DEFAULT_PET_MODEL);
  const coercedThemeId = coerceThemeIdForModel(themeId, form.model);
  const theme = getPetTheme(coercedThemeId);
  const defaultNickname =
    form.model === "chip"
      ? theme.chipNickname
      : form.defaultNickname ?? "桌宠";

  return {
    id: `${form.model}:${theme.id}`,
    model: form.model,
    themeId: theme.id,
    nameKey:
      form.model === "toon" && theme.toonNameKey
        ? theme.toonNameKey
        : theme.nameKey,
    defaultNickname,
    visual: theme.visual,
    figArtId: theme.figArtId,
    toonDecor: form.model === "toon" ? theme.toonDecor : undefined,
    intro: form.intro,
  };
}

export type { PetModelKind, PetSkinVisual } from "./types";
export type { PetThemeDef, PetFigArtId, PetToonDecorId } from "./themes";
export type { PetFormDef } from "./forms";
export {
  listPetThemes,
  listPetThemesForModel,
  coerceThemeIdForModel,
  defaultThemeIdForModel,
  getPetTheme,
  isPetThemeId,
  DEFAULT_PET_THEME_ID,
  DEFAULT_FIG_THEME_ID,
} from "./themes";
export {
  listPetForms,
  getPetForm,
  isPetModelKind,
  DEFAULT_PET_MODEL,
} from "./forms";
export { resolveNickname } from "./types";
