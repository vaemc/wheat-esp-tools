#!/usr/bin/env node
/**
 * 合并各平台 updater-platform-*.json → latest.json
 * Usage: node .github/scripts/build-latest-json.mjs <version> <metaDir> <outFile>
 */
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const version = process.argv[2];
const metaDir = process.argv[3] || ".github/updater-meta";
const outFile = process.argv[4] || "latest.json";

if (!version) {
  console.error("Usage: node build-latest-json.mjs <version> [metaDir] [outFile]");
  process.exit(1);
}

const platforms = {};
for (const name of readdirSync(metaDir)) {
  if (!name.endsWith(".json")) {
    continue;
  }
  const raw = readFileSync(join(metaDir, name), "utf8").trim();
  if (!raw) {
    continue;
  }
  const meta = JSON.parse(raw);
  if (!meta.platform || !meta.url || !meta.signature) {
    console.error(`Invalid updater meta: ${name}`);
    process.exit(1);
  }
  platforms[meta.platform] = {
    url: meta.url,
    signature: meta.signature,
  };
  console.log(`+ ${meta.platform}`);
}

if (Object.keys(platforms).length === 0) {
  console.error("No updater platform meta found");
  process.exit(1);
}

const latest = {
  version,
  notes: `Wheat ESP Tools v${version}`,
  pub_date: new Date().toISOString(),
  platforms,
};

writeFileSync(outFile, `${JSON.stringify(latest, null, 2)}\n`);
console.log(`Wrote ${outFile} with ${Object.keys(platforms).length} platform(s)`);
