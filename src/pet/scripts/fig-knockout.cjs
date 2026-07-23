/**
 * 将本地源图抠成透明立绘（源图目录已 gitignore，仅本地使用）。
 * 依赖：yarn add -D sharp && node src/pet/scripts/fig-knockout.cjs && yarn remove sharp
 *
 * 源图路径：src/pet/Generated_image/
 * 输出路径：src/pet/assets/fig/（性格款 + 节日限定，均为梨宝可选形象）
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const PET_ROOT = path.join(__dirname, "..");
const SRC = path.join(PET_ROOT, "Generated_image");
const OUT = path.join(PET_ROOT, "assets", "fig");

const MAP = [
  ["Generated_image_cool.png", "cool.png"],
  ["Generated_image_happy.png", "sunny.png"],
  ["Generated_image_shy.png", "shy.png"],
  ["Generated_image_angry.png", "fiery.png"],
  ["Generated_image_valentine.png", "valentine.png"],
  ["Generated_image_spring.png", "spring.png"],
  ["Generated_image_midautumn.png", "midautumn.png"],
  ["Generated_image_labor.png", "labor.png"],
];

function isBg(r, g, b, a) {
  if (a < 8) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const avg = (r + g + b) / 3;
  // solid black / near-black matte (common for AI standing arts)
  if (max <= 28 && chroma <= 12) return true;
  // checker / flat gray matte
  if (chroma <= 18 && avg >= 95 && avg <= 235) return true;
  // near-white matte
  if (chroma <= 12 && avg >= 235) return true;
  return false;
}

async function knockout(srcPath, outPath) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = new Uint8ClampedArray(data);
  const n = w * h;
  const mark = new Uint8Array(n);

  const idx = (x, y) => y * w + x;
  const queue = [];

  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = idx(x, y);
    if (mark[i]) return;
    const o = i * 4;
    if (!isBg(px[o], px[o + 1], px[o + 2], px[o + 3])) return;
    mark[i] = 1;
    queue.push(i);
  };

  // seed from edges
  for (let x = 0; x < w; x++) {
    tryPush(x, 0);
    tryPush(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryPush(0, y);
    tryPush(w - 1, y);
  }

  while (queue.length) {
    const i = queue.pop();
    const x = i % w;
    const y = (i / w) | 0;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }

  // also clear any fully enclosed checker islands (small blobs of bg-looking pixels)
  for (let i = 0; i < n; i++) {
    if (mark[i]) continue;
    const o = i * 4;
    if (!isBg(px[o], px[o + 1], px[o + 2], px[o + 3])) continue;
    // only if neighbors are mostly marked bg or also bg-looking
    const x = i % w;
    const y = (i / w) | 0;
    let bgN = 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
        bgN++;
        continue;
      }
      const ni = idx(nx, ny);
      if (mark[ni]) bgN++;
    }
    if (bgN >= 3) mark[i] = 1;
  }

  // feather: edge pixels near bg get reduced alpha
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (mark[i]) {
      px[o + 3] = 0;
      continue;
    }
    const x = i % w;
    const y = (i / w) | 0;
    let near = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
          near++;
          continue;
        }
        if (mark[idx(nx, ny)]) near++;
      }
    }
    if (near >= 3) {
      px[o + 3] = Math.min(px[o + 3], Math.round(255 * (1 - near / 10)));
    }
  }

  let outBuf = await sharp(px, {
    raw: { width: w, height: h, channels: 4 },
  })
    .resize({ height: 720, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, outBuf);
  console.log(
    path.basename(outPath),
    `${w}x${h}`,
    `-> ${(outBuf.length / 1024).toFixed(0)}KB`
  );
}

(async () => {
  for (const [from, to] of MAP) {
    const src = path.join(SRC, from);
    if (!fs.existsSync(src)) {
      console.warn("missing", from);
      continue;
    }
    await knockout(src, path.join(OUT, to));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
