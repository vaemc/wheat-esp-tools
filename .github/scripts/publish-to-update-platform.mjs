#!/usr/bin/env node
/**
 * 在各平台产物都上传到 Wheat Update Platform 后，发布为 latest。
 * 未配置 Secret 时跳过。
 *
 * Usage:
 *   APP_SLUG=wheat-esp-tools \
 *   UPDATE_PLATFORM_BASE_URL=https://update.example.com \
 *   UPDATE_PLATFORM_DEPLOY_TOKEN=xxx \
 *   node .github/scripts/publish-to-update-platform.mjs <version> [notes]
 */
const version = process.argv[2];
const notesArg = process.argv[3];
const slug = process.env.APP_SLUG || "wheat-esp-tools";
const title = process.env.APP_TITLE || slug;
const baseUrl = (process.env.UPDATE_PLATFORM_BASE_URL || "").replace(/\/+$/, "");
const token = process.env.UPDATE_PLATFORM_DEPLOY_TOKEN || "";

if (!version) {
  console.error("Usage: node publish-to-update-platform.mjs <version> [notes]");
  process.exit(1);
}

if (!baseUrl || !token) {
  console.log(
    "Skip Wheat Update Platform publish (UPDATE_PLATFORM_BASE_URL / UPDATE_PLATFORM_DEPLOY_TOKEN not set)."
  );
  process.exit(0);
}

const notes = notesArg || `${title} v${version}`;
const endpoint = `${baseUrl}/api/ci/${encodeURIComponent(slug)}/releases/${encodeURIComponent(version)}/publish`;

console.log(`Publishing ${slug}@${version} -> ${endpoint}`);

const res = await fetch(endpoint, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    notes,
    set_latest: true,
  }),
});

const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  data = { raw: text };
}

if (!res.ok) {
  console.error("Publish failed:", res.status, data);
  process.exit(1);
}

console.log("Published on Wheat Update Platform:");
console.log(JSON.stringify(data, null, 2));
if (data.latest_json_url) {
  console.log(`latest.json: ${data.latest_json_url}`);
}
