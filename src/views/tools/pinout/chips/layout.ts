/**
 * Generic QFN-style layout helpers driven by `PackageLayout`.
 *
 * Pin 1 sits in the top-left corner; numbering proceeds counter-clockwise:
 *   - Left side  (top → bottom): pins 1                              .. P
 *   - Bottom    (left → right):  pins (P+1)                          .. 2P
 *   - Right side (bottom → top): pins (2P+1)                         .. 3P
 *   - Top side  (right → left):  pins (3P+1)                         .. 4P
 *   - Center thermal pad (GND):  pins (4P+1) (optional)
 *
 * Where P = pinsPerSide.
 */
import type { PackageLayout, PinSide } from "./types";

/** Build a QFN package descriptor from total pin count + optional centre pad. */
export function makeQfn(pinCount: number, centerPin: number | null = null): PackageLayout {
  const pinsPerSide = pinCount / 4;
  if (!Number.isInteger(pinsPerSide)) {
    throw new Error(`QFN pin count must be divisible by 4 (got ${pinCount})`);
  }
  return {
    type: "QFN",
    pinCount,
    pinsPerSide,
    centerPin,
    packageName: `QFN-${pinCount}${centerPin != null ? "+1" : ""}`,
  };
}

export function pinSide(num: number, layout: PackageLayout): PinSide {
  const P = layout.pinsPerSide;
  if (layout.centerPin != null && num === layout.centerPin) return "center";
  if (num >= 1 && num <= P) return "left";
  if (num >= P + 1 && num <= 2 * P) return "bottom";
  if (num >= 2 * P + 1 && num <= 3 * P) return "right";
  if (num >= 3 * P + 1 && num <= 4 * P) return "top";
  return "center";
}

/** 0-based index within its side (0 = closest to pin 1 / top-left corner). */
export function pinIndexOnSide(num: number, layout: PackageLayout): number {
  const P = layout.pinsPerSide;
  switch (pinSide(num, layout)) {
    case "left":
      return num - 1;
    case "bottom":
      return num - (P + 1);
    case "right":
      return 3 * P - num;
    case "top":
      return 4 * P - num;
    default:
      return 0;
  }
}

export function pinsOnSide(side: PinSide, layout: PackageLayout): number[] {
  const P = layout.pinsPerSide;
  switch (side) {
    case "left":
      return Array.from({ length: P }, (_, i) => i + 1);
    case "bottom":
      return Array.from({ length: P }, (_, i) => i + P + 1);
    case "right":
      return Array.from({ length: P }, (_, i) => 3 * P - i);
    case "top":
      return Array.from({ length: P }, (_, i) => 4 * P - i);
    case "center":
      return layout.centerPin != null ? [layout.centerPin] : [];
  }
}
