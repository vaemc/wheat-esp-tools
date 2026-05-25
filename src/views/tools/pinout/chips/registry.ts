/**
 * Auto-discover chip definitions from `../chips-data/*.json`.
 *
 *   • Drop a new JSON file into `src/views/tools/pinout/chips-data/` and it
 *     will appear in the chip picker after the next build — no code change
 *     required.
 *   • Each file must follow the {@link ChipDefinition} shape
 *     (see ./types.ts).  Use `scripts/build-chips-data.cjs` to generate
 *     them from the per-chip metadata + extracted pin tables.
 */
import type { ChipDefinition } from "./types";

// Vite turns this into a static map at build time, so all chip JSON files
// are bundled into the JS payload (no runtime fetch needed) but adding a
// new chip is still as simple as dropping a JSON file in the folder.
const modules = import.meta.glob<ChipDefinition>("../chips-data/*.json", {
  eager: true,
  import: "default",
});

function loadChips(): ChipDefinition[] {
  const list: ChipDefinition[] = [];
  for (const [filePath, def] of Object.entries(modules)) {
    if (!def || typeof def !== "object") {
      console.warn(`[pinout] Skipping ${filePath} — invalid chip JSON`);
      continue;
    }
    if (!def.id || !Array.isArray(def.variants) || def.variants.length === 0) {
      console.warn(`[pinout] Skipping ${filePath} — missing id or variants`);
      continue;
    }
    list.push(def);
  }
  // Stable, intentional order: lower displayOrder first, then by name.
  list.sort((a, b) => {
    const oa = a.displayOrder ?? 100;
    const ob = b.displayOrder ?? 100;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });
  return list;
}

export const CHIPS: ChipDefinition[] = loadChips();

export const CHIPS_BY_ID = Object.fromEntries(
  CHIPS.map((c) => [c.id, c]),
) as Record<string, ChipDefinition>;

export const DEFAULT_CHIP_ID = CHIPS[0]?.id ?? "";

if (CHIPS.length === 0) {
  console.error(
    "[pinout] No chip definitions found in chips-data/. Run \n" +
      "    node src/views/tools/pinout/scripts/build-chips-data.cjs",
  );
}
