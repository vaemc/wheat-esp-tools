import { existsSync, readdirSync, renameSync } from "fs";
import { join } from "path";

const platform = process.argv[2];
const version = process.argv[3];
const slug = process.env.APP_SLUG;

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

  const candidates = [join(targetDir, "release", "bundle")];

  for (const entry of readdirSync(targetDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "release" || entry.name.startsWith(".")) {
      continue;
    }
    candidates.push(join(targetDir, entry.name, "release", "bundle"));
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function renameFiles(dir, { suffix, mapName }) {
  if (!existsSync(dir)) {
    console.warn(`Directory not found: ${dir}`);
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

    renameSync(join(dir, entry.name), join(dir, newName));
    renamed.push(join(dir, newName));
    console.log(`Renamed: ${entry.name} -> ${newName}`);
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
    ...renameFiles(join(bundleRoot, "msi"), {
      suffix: ".msi",
      mapName: () => `${slug}-${version}-windows-x64.msi`,
    })
  );
  files.push(
    ...renameFiles(join(bundleRoot, "nsis"), {
      suffix: "-setup.exe",
      mapName: () => `${slug}-${version}-windows-x64-setup.exe`,
    })
  );
} else if (platform === "ubuntu-22.04") {
  files.push(
    ...renameFiles(join(bundleRoot, "deb"), {
      suffix: ".deb",
      mapName: () => `${slug}-${version}-linux-amd64.deb`,
    })
  );
  files.push(
    ...renameFiles(join(bundleRoot, "appimage"), {
      suffix: ".AppImage",
      mapName: () => `${slug}-${version}-linux-amd64.AppImage`,
    })
  );
} else if (platform === "macos-latest") {
  files.push(
    ...renameFiles(join(bundleRoot, "dmg"), {
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
  process.exit(1);
}

console.log(`Renamed ${files.length} asset(s)`);
