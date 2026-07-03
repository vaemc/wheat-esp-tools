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

const bundleRoot = join("src-tauri", "target", "release", "bundle");

function renameFiles(dir, mapName) {
  if (!existsSync(dir)) {
    console.warn(`Directory not found: ${dir}`);
    return [];
  }

  const renamed = [];
  for (const file of readdirSync(dir)) {
    const newName = mapName(file);
    if (!newName || newName === file) {
      continue;
    }
    renameSync(join(dir, file), join(dir, newName));
    renamed.push(join(dir, newName));
    console.log(`Renamed: ${file} -> ${newName}`);
  }
  return renamed;
}

let files = [];

if (platform === "windows-latest") {
  files.push(
    ...renameFiles(join(bundleRoot, "msi"), () => `${slug}-${version}-windows-x64.msi`)
  );
  files.push(
    ...renameFiles(join(bundleRoot, "nsis"), (file) =>
      file.endsWith("-setup.exe") ? `${slug}-${version}-windows-x64-setup.exe` : null
    )
  );
} else if (platform === "ubuntu-22.04") {
  files.push(
    ...renameFiles(join(bundleRoot, "deb"), () => `${slug}-${version}-linux-amd64.deb`)
  );
  files.push(
    ...renameFiles(
      join(bundleRoot, "appimage"),
      () => `${slug}-${version}-linux-amd64.AppImage`
    )
  );
} else if (platform === "macos-latest") {
  files.push(
    ...renameFiles(join(bundleRoot, "dmg"), () => `${slug}-${version}-macos-aarch64.dmg`)
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
