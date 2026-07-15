/** 调色板条目 BGRA（与 EAF 调色板一致） */
export type PaletteEntry = [number, number, number, number];

export function grayPalette(bitDepth: 4 | 8): Uint8Array {
  const n = 1 << bitDepth;
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const g = Math.round((i * 255) / (n - 1));
    const o = i * 4;
    out[o] = g;
    out[o + 1] = g;
    out[o + 2] = g;
    out[o + 3] = 255;
  }
  return out;
}

function colorDist(
  r: number,
  g: number,
  b: number,
  pr: number,
  pg: number,
  pb: number
) {
  const dr = r - pr;
  const dg = g - pg;
  const db = b - pb;
  return dr * dr + dg * dg + db * db;
}

/** Floyd–Steinberg 抖动到 4bit 灰度索引 */
export function quantizeGray4(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): { indices: Uint8Array; palette: Uint8Array } {
  const palette = grayPalette(4);
  const buffer = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    buffer[i] =
      0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
  }
  const indices = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const old = buffer[i];
      const level = Math.max(0, Math.min(15, Math.round((old / 255) * 15)));
      indices[i] = level;
      const neu = (level * 255) / 15;
      const err = old - neu;
      if (x + 1 < width) {
        buffer[i + 1] += (err * 7) / 16;
      }
      if (y + 1 < height) {
        if (x > 0) {
          buffer[i + width - 1] += (err * 3) / 16;
        }
        buffer[i + width] += (err * 5) / 16;
        if (x + 1 < width) {
          buffer[i + width + 1] += (err * 1) / 16;
        }
      }
    }
  }
  return { indices, palette };
}

type Pixel = { r: number; g: number; b: number; a: number; count: number };

function medianCut(pixels: Pixel[], maxColors: number): PaletteEntry[] {
  if (pixels.length === 0) {
    return [[0, 0, 0, 255]];
  }
  type Box = { pixels: Pixel[]; };
  const boxes: Box[] = [{ pixels }];

  while (boxes.length < maxColors) {
    let best = -1;
    let bestRange = -1;
    for (let i = 0; i < boxes.length; i++) {
      const ps = boxes[i].pixels;
      if (ps.length <= 1) {
        continue;
      }
      let minR = 255,
        maxR = 0,
        minG = 255,
        maxG = 0,
        minB = 255,
        maxB = 0;
      for (const p of ps) {
        minR = Math.min(minR, p.r);
        maxR = Math.max(maxR, p.r);
        minG = Math.min(minG, p.g);
        maxG = Math.max(maxG, p.g);
        minB = Math.min(minB, p.b);
        maxB = Math.max(maxB, p.b);
      }
      const range = Math.max(maxR - minR, maxG - minG, maxB - minB);
      if (range > bestRange) {
        bestRange = range;
        best = i;
      }
    }
    if (best < 0 || bestRange <= 0) {
      break;
    }
    const box = boxes[best];
    const ps = box.pixels;
    let minR = 255,
      maxR = 0,
      minG = 255,
      maxG = 0,
      minB = 255,
      maxB = 0;
    for (const p of ps) {
      minR = Math.min(minR, p.r);
      maxR = Math.max(maxR, p.r);
      minG = Math.min(minG, p.g);
      maxG = Math.max(maxG, p.g);
      minB = Math.min(minB, p.b);
      maxB = Math.max(maxB, p.b);
    }
    const rangeR = maxR - minR;
    const rangeG = maxG - minG;
    const rangeB = maxB - minB;
    const channel =
      rangeR >= rangeG && rangeR >= rangeB
        ? "r"
        : rangeG >= rangeB
          ? "g"
          : "b";
    ps.sort((a, b) => a[channel] - b[channel]);
    const mid = Math.floor(ps.length / 2);
    boxes[best] = { pixels: ps.slice(0, mid) };
    boxes.push({ pixels: ps.slice(mid) });
  }

  return boxes.map((box) => {
    let r = 0,
      g = 0,
      b = 0,
      a = 0,
      w = 0;
    for (const p of box.pixels) {
      r += p.r * p.count;
      g += p.g * p.count;
      b += p.b * p.count;
      a += p.a * p.count;
      w += p.count;
    }
    if (w === 0) {
      return [0, 0, 0, 255] as PaletteEntry;
    }
    return [
      Math.round(b / w),
      Math.round(g / w),
      Math.round(r / w),
      Math.round(a / w) || 255,
    ] as PaletteEntry;
  });
}

/** 8bit 彩色：median-cut 量化为 ≤256 色 */
export function quantizeColor8(
  rgba: Uint8ClampedArray
): { indices: Uint8Array; palette: Uint8Array } {
  const countMap = new Map<number, Pixel>();
  const n = rgba.length / 4;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const r = rgba[o];
    const g = rgba[o + 1];
    const b = rgba[o + 2];
    const a = rgba[o + 3];
    const key = (a << 24) | (r << 16) | (g << 8) | b;
    const exist = countMap.get(key);
    if (exist) {
      exist.count += 1;
    } else {
      countMap.set(key, { r, g, b, a, count: 1 });
    }
  }
  const unique = [...countMap.values()];
  const entries =
    unique.length <= 256 ? unique.map((p) => [p.b, p.g, p.r, p.a || 255] as PaletteEntry) : medianCut(unique, 256);

  const palette = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const e = entries[Math.min(i, entries.length - 1)] ?? [0, 0, 0, 255];
    const o = i * 4;
    palette[o] = e[0];
    palette[o + 1] = e[1];
    palette[o + 2] = e[2];
    palette[o + 3] = e[3];
  }
  // 未用槽清零（透明哨兵）
  for (let i = entries.length; i < 256; i++) {
    const o = i * 4;
    palette[o] = 0;
    palette[o + 1] = 0;
    palette[o + 2] = 0;
    palette[o + 3] = 0;
  }

  const indices = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const r = rgba[o];
    const g = rgba[o + 1];
    const b = rgba[o + 2];
    let best = 0;
    let bestD = Infinity;
    for (let c = 0; c < entries.length; c++) {
      const po = c * 4;
      const d = colorDist(r, g, b, palette[po + 2], palette[po + 1], palette[po]);
      if (d < bestD) {
        bestD = d;
        best = c;
        if (d === 0) {
          break;
        }
      }
    }
    indices[i] = best;
  }
  return { indices, palette };
}

export function packIndices4(indices: Uint8Array, width: number, height: number): Uint8Array {
  const rowBytes = Math.ceil(width / 2);
  const out = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x += 2) {
      const i0 = indices[y * width + x] & 0x0f;
      const i1 = x + 1 < width ? indices[y * width + x + 1] & 0x0f : 0;
      out[y * rowBytes + (x >> 1)] = (i0 << 4) | i1;
    }
  }
  return out;
}

export function unpackIndices4(
  packed: Uint8Array,
  pixelCount: number
): Uint8Array {
  const out = new Uint8Array(pixelCount);
  let o = 0;
  for (let i = 0; i < packed.length && o < pixelCount; i++) {
    out[o++] = (packed[i] >> 4) & 0x0f;
    if (o < pixelCount) {
      out[o++] = packed[i] & 0x0f;
    }
  }
  return out;
}
