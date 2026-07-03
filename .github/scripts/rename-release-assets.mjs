import { existsSync, readdirSync, renameSync, writeFileSync } from "fs";
import { join } from "path";

const platform = process.argv[2];
const version = process.argv[3];
const slug = process.env.APP_SLUG;
const assetListPath = ".github/release-assets.txt";

if (!slug || !version || !platform) {
  console.error(
    "Usage: APP_SLUG=<slug> node .github/scripts/rename-release-assets.mjs <platform> <version>"
  );
  process.exit(1);
}

function findBundleRoot() {
  const targetDir = join("src-tauri", "target");
  if (!existsSync(targetDir)) {
    return null;
  }

  const candidates = [];

  function walk(dir, depth = 0) {
    if (depth > 4 || !existsSync(dir)) {
      return;
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) {
        continue;
      }
      const next = join(dir, entry.name);
      if (entry.name === "bundle") {
        candidates.push(next);
        continue;
      }
      walk(next, depth + 1);
    }
  }

  walk(targetDir);
  return candidates[0] ?? null;
}

function renameFiles(dir, { suffix, mapName }) {
  if (!existsSync(dir)) {
    return [];
  }

  const renamed = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    if (suffix && !entry.name.endsWith(suffix)) {
      continue;
    }

    const newName = mapName(entry.name);
    if (!newName || newName === entry.name) {
      continue;
    }

    const from = join(dir, entry.name);
    const to = join(dir, newName);
    renameSync(from, to);
    renamed.push(to);
    console.log(`Renamed: ${entry.name} -> ${newName}`);
  }
  return renamed;
}

function renameInBundle(bundleRoot, subdirs, options) {
  const renamed = [];
  for (const subdir of subdirs) {
    renamed.push(...renameFiles(join(bundleRoot, subdir), options));
  }
  return renamed;
}

const bundleRoot = findBundleRoot();
if (!bundleRoot) {
  console.error("Bundle directory not found under src-tauri/target");
  process.exit(1);
}

console.log(`Using bundle root: ${bundleRoot}`);

let files = [];

if (platform === "windows-latest") {
  files.push(
    ...renameInBundle(bundleRoot, ["msi"], {
      suffix: ".msi",
      mapName: () => `${slug}-${version}-windows-x64.msi`,
    }),
    ...renameInBundle(bundleRoot, ["nsis"], {
      suffix: "-setup.exe",
      mapName: () => `${slug}-${version}-windows-x64-setup.exe`,
    })
  );
} else if (platform === "ubuntu-22.04") {
  files.push(
    ...renameInBundle(bundleRoot, ["deb"], {
      suffix: ".deb",
      mapName: () => `${slug}-${version}-linux-amd64.deb`,
    }),
    ...renameInBundle(bundleRoot, ["appimage"], {
      suffix: ".AppImage",
      mapName: () => `${slug}-${version}-linux-amd64.AppImage`,
    })
  );
} else if (platform === "macos-latest") {
  files.push(
    ...renameInBundle(bundleRoot, ["dmg", "macos"], {
      suffix: ".dmg",
      mapName: () => `${slug}-${version}-macos-aarch64.dmg`,
    })
  );
} else {
  console.error(`Unknown platform: ${platform}`);
  process.exit(1);
}

if (files.length === 0) {
  console.error("No release assets renamed");
  console.error("Bundle contents:");
  for (const entry of readdirSync(bundleRoot, { withFileTypes: true })) {
    const path = join(bundleRoot, entry.name);
    if (entry.isDirectory()) {
      console.error(`  ${entry.name}/`);
      for (const child of readdirSync(path, { withFileTypes: true })) {
        console.error(`    ${child.name}${child.isDirectory() ? "/" : ""}`);
      }
    } else {
      console.error(`  ${entry.name}`);
    }
  }
  process.exit(1);
}

writeFileSync(assetListPath, `${files.join("\n")}\n`);
console.log(`Renamed ${files.length} asset(s)`);
for (const file of files) {
  console.log(`  ${file}`);
}
