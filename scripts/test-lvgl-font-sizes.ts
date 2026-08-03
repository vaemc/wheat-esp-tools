/**
 * 多字号解析 / 命名健壮性自测（不依赖 Vitest）。
 * 运行：npx --yes tsx scripts/test-lvgl-font-sizes.ts
 */
import {
  LVGL_FONT_SIZES_MAX_COUNT,
  buildDisplayAutoFontName,
  clampFontSize,
  normalizeFontSizes,
  parseFontSizesInput,
  resolveFontNameForSize,
} from "../src/utils/font/lvgl/fontSizes.ts";

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed += 1;
    console.log(`  OK  ${msg}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${msg}`);
  }
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  assert(ok, `${msg} (got ${JSON.stringify(actual)})`);
}

console.log("clampFontSize");
assertEq(clampFontSize(16), 16, "normal");
assertEq(clampFontSize("24"), 24, "numeric string");
assertEq(clampFontSize(3), 4, "below min → 4");
assertEq(clampFontSize(999), 256, "above max → 256");
assertEq(clampFontSize(16.6), 17, "round");
assertEq(clampFontSize("16px"), null, "reject unit suffix");
assertEq(clampFontSize(""), null, "empty");
assertEq(clampFontSize("abc"), null, "non-numeric");
assertEq(clampFontSize(NaN), null, "NaN");
assertEq(clampFontSize(Infinity), null, "Infinity");
assertEq(clampFontSize(null), null, "null");
assertEq(clampFontSize(undefined), null, "undefined");

console.log("normalizeFontSizes");
assertEq(normalizeFontSizes([]), [16], "empty → default 16");
assertEq(normalizeFontSizes([20, 16, 20, 14]), [14, 16, 20], "dedupe+sort");
assertEq(normalizeFontSizes(["16", 3, 300]), [4, 16, 256], "clamp extremes");
assertEq(normalizeFontSizes([null, "x", undefined]), [16], "all invalid → default");
{
  const many = Array.from({ length: 30 }, (_, i) => i + 10);
  const out = normalizeFontSizes(many);
  assertEq(out.length, LVGL_FONT_SIZES_MAX_COUNT, "cap at max count");
  assert(out[0] === 10 && out[out.length - 1] === 10 + LVGL_FONT_SIZES_MAX_COUNT - 1, "keeps first unique in order then sorts");
}

console.log("parseFontSizesInput");
{
  const r = parseFontSizesInput(["14", "16", "20"]);
  assertEq(r.sizes, [14, 16, 20], "array of strings");
  assertEq(r.truncated, false, "not truncated");
  assertEq(r.invalidCount, 0, "no invalid");
}
{
  const r = parseFontSizesInput("14, 16；20、24");
  assertEq(r.sizes, [14, 16, 20, 24], "mixed separators");
}
{
  const r = parseFontSizesInput(["16", "foo", "12px", "18"]);
  assertEq(r.sizes, [16, 18], "skip invalid tokens");
  assert(r.invalidCount >= 2, "counts invalid");
}
{
  const r = parseFontSizesInput(Array.from({ length: 20 }, (_, i) => 10 + i));
  assertEq(r.sizes.length, LVGL_FONT_SIZES_MAX_COUNT, "truncates unique list");
  assertEq(r.truncated, true, "truncated flag");
}
{
  const r = parseFontSizesInput("");
  assertEq(r.sizes, [16], "blank → default");
}

console.log("resolveFontNameForSize");
assertEq(
  resolveFontNameForSize({
    autoName: true,
    nameSlug: "arial",
    baseFontName: "ignored",
    size: 16,
    bpp: 4,
    sizeCount: 3,
  }),
  "font_arial_16_4",
  "auto name ignores base"
);
assertEq(
  resolveFontNameForSize({
    autoName: false,
    nameSlug: "arial",
    baseFontName: "my_font",
    size: 16,
    bpp: 4,
    sizeCount: 1,
  }),
  "my_font",
  "manual single size keeps base"
);
assertEq(
  resolveFontNameForSize({
    autoName: false,
    nameSlug: "arial",
    baseFontName: "my_font",
    size: 20,
    bpp: 4,
    sizeCount: 3,
  }),
  "my_font_20",
  "manual multi appends size"
);
assertEq(
  resolveFontNameForSize({
    autoName: false,
    nameSlug: "arial",
    baseFontName: "my_font_20",
    size: 20,
    bpp: 4,
    sizeCount: 3,
  }),
  "my_font_20",
  "manual multi does not double-append size"
);
assertEq(
  buildDisplayAutoFontName("noto", [24, 16], 4),
  "font_noto_16_4",
  "display name uses smallest after normalize"
);

console.log("uniqueFileName logic (inline)");
function uniqueFileName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let i = 2;
  let candidate = `${stem}_${i}${ext}`;
  while (used.has(candidate)) {
    i += 1;
    candidate = `${stem}_${i}${ext}`;
  }
  used.add(candidate);
  return candidate;
}
{
  const used = new Set<string>();
  assertEq(uniqueFileName("a.c", used), "a.c", "first");
  assertEq(uniqueFileName("a.c", used), "a_2.c", "collision → _2");
  assertEq(uniqueFileName("a.c", used), "a_3.c", "collision → _3");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
