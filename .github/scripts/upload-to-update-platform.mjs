#!/usr/bin/env node
/**
 * 将当前平台的 updater 产物推送到 Wheat Update Platform（可选）。
 * 未配置 UPDATE_PLATFORM_BASE_URL / UPDATE_PLATFORM_DEPLOY_TOKEN 时跳过。
 *
 * Usage:
 *   APP_SLUG=wheat-esp-tools \
 *   UPDATE_PLATFORM_BASE_URL=https://update.example.com \
 *   UPDATE_PLATFORM_DEPLOY_TOKEN=xxx \
 *   node .github/scripts/upload-to-update-platform.mjs <version>
 */
import { basename, dirname, join } from "path";
import { existsSync, readFileSync } from "fs";

const version = process.argv[2];
const slug = process.env.APP_SLUG || "wheat-esp-tools";
const baseUrl = (process.env.UPDATE_PLATFORM_BASE_URL || "").replace(/\/+$/, "");
const token = process.env.UPDATE_PLATFORM_DEPLOY_TOKEN || "";
const metaPath = ".github/updater-platform.json";
const assetListPath = ".github/release-assets.txt";

if (!version) {
  console.error("Usage: node upload-to-update-platform.mjs <version>");
  process.exit(1);
}

if (!baseUrl || !token) {
  console.log(
    "Skip Wheat Update Platform upload (UPDATE_PLATFORM_BASE_URL / UPDATE_PLATFORM_DEPLOY_TOKEN not set)."
  );
  process.exit(0);
}

if (!existsSync(metaPath) || !existsSync(assetListPath)) {
  console.error("Missing updater-platform.json or release-assets.txt");
  process.exit(1);
}

const metaRaw = readFileSync(metaPath, "utf8").trim();
if (!metaRaw) {
  console.error("updater-platform.json is empty");
  process.exit(1);
}

const meta = JSON.parse(metaRaw);
if (!meta.platform || !meta.url || !meta.signature) {
  console.error("Invalid updater-platform.json:", meta);
  process.exit(1);
}

const filename = basename(new URL(meta.url).pathname);
const assets = readFileSync(assetListPath, "utf8")
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

let filePath = assets.find((p) => basename(p) === filename && !p.endsWith(".sig"));
if (!filePath) {
  // fallback: same dir as any listed asset
  const sibling = assets.find((p) => !p.endsWith(".sig"));
  if (sibling) {
    const candidate = join(dirname(sibling), filename);
    if (existsSync(candidate)) {
      filePath = candidate;
    }
  }
}

if (!filePath || !existsSync(filePath)) {
  console.error(`Updater asset not found locally: ${filename}`);
  console.error("Assets:", assets);
  process.exit(1);
}

const sigPath = existsSync(`${filePath}.sig`)
  ? `${filePath}.sig`
  : assets.find((p) => basename(p) === `${filename}.sig`);

if (!sigPath || !existsSync(sigPath)) {
  console.error(`Signature file not found for ${filename}`);
  process.exit(1);
}

const signature = readFileSync(sigPath, "utf8");
const fileBytes = readFileSync(filePath);
const endpoint = `${baseUrl}/api/ci/${encodeURIComponent(slug)}/releases/${encodeURIComponent(version)}/assets`;

console.log(`Uploading ${filename} (${fileBytes.length} bytes) -> ${endpoint}`);
console.log(`  platform=${meta.platform}`);

const form = new FormData();
form.set("platform", meta.platform);
form.set("signature", signature);
form.set("filename", filename);
form.set(
  "file",
  new File([fileBytes], filename, { type: "application/octet-stream" })
);

const res = await fetch(endpoint, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: form,
});

const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  data = { raw: text };
}

if (!res.ok) {
  console.error("Upload failed:", res.status, data);
  process.exit(1);
}

console.log("Uploaded to Wheat Update Platform:", data);
