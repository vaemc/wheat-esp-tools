import {
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "fs";
import { basename, join } from "path";

const platform = process.argv[2];
const version = process.argv[3];
const slug = process.env.APP_SLUG;
const repo = process.env.GITHUB_REPOSITORY || "vaemc/wheat-esp-tools";
const assetListPath = ".github/release-assets.txt";
const updaterMetaPath = ".github/updater-platform.json";

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

function renameOne(fromDir, fromName, toName) {
  const from = join(fromDir, fromName);
  const to = join(fromDir, toName);
  if (!existsSync(from)) {
    return null;
  }
  if (from !== to) {
    renameSync(from, to);
    console.log(`Renamed: ${fromName} -> ${toName}`);
  }
  return to;
}

function findFirstFile(dir, predicate) {
  if (!existsSync(dir)) {
    return null;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    if (predicate(entry.name)) {
      return entry.name;
    }
  }
  return null;
}

function collectWithSig(dir, fileName) {
  const files = [];
  const main = join(dir, fileName);
  if (!existsSync(main)) {
    return files;
  }
  files.push(main);
  const sigName = `${fileName}.sig`;
  const sigPath = join(dir, sigName);
  if (existsSync(sigPath)) {
    files.push(sigPath);
  } else {
    // 尝试原名 .sig（重命名后可能仍叫旧名）
    console.warn(`Missing signature: ${sigPath}`);
  }
  return files;
}

const bundleRoot = findBundleRoot();
if (!bundleRoot) {
  console.error("Bundle directory not found under src-tauri/target");
  process.exit(1);
}

console.log(`Using bundle root: ${bundleRoot}`);

/** @type {string[]} */
let files = [];
/** @type {{ platform: string, url: string, signature: string } | null} */
let updaterPlatform = null;

const downloadBase = `https://github.com/${repo}/releases/download/v${version}`;

if (platform === "windows-latest") {
  const msiDir = join(bundleRoot, "msi");
  const nsisDir = join(bundleRoot, "nsis");

  const msiOld = findFirstFile(msiDir, (n) => n.endsWith(".msi") && !n.endsWith(".sig"));
  if (msiOld) {
    const msiNew = `${slug}-${version}-windows-x64.msi`;
    renameOne(msiDir, msiOld, msiNew);
    renameOne(msiDir, `${msiOld}.sig`, `${msiNew}.sig`);
    files.push(...collectWithSig(msiDir, msiNew));
  }

  const nsisOld = findFirstFile(
    nsisDir,
    (n) => n.endsWith("-setup.exe") || (n.endsWith(".exe") && !n.endsWith(".sig"))
  );
  if (nsisOld) {
    const nsisNew = `${slug}-${version}-windows-x64-setup.exe`;
    renameOne(nsisDir, nsisOld, nsisNew);
    renameOne(nsisDir, `${nsisOld}.sig`, `${nsisNew}.sig`);
    files.push(...collectWithSig(nsisDir, nsisNew));

    const sigPath = join(nsisDir, `${nsisNew}.sig`);
    if (existsSync(sigPath)) {
      updaterPlatform = {
        platform: "windows-x86_64",
        url: `${downloadBase}/${nsisNew}`,
        signature: readFileSync(sigPath, "utf8").trim(),
      };
    }
  }
} else if (platform === "ubuntu-22.04") {
  const debDir = join(bundleRoot, "deb");
  const appimageDir = join(bundleRoot, "appimage");

  const debOld = findFirstFile(debDir, (n) => n.endsWith(".deb") && !n.endsWith(".sig"));
  if (debOld) {
    const debNew = `${slug}-${version}-linux-amd64.deb`;
    renameOne(debDir, debOld, debNew);
    renameOne(debDir, `${debOld}.sig`, `${debNew}.sig`);
    files.push(...collectWithSig(debDir, debNew));
  }

  const appOld = findFirstFile(
    appimageDir,
    (n) => n.endsWith(".AppImage") && !n.endsWith(".sig")
  );
  if (appOld) {
    const appNew = `${slug}-${version}-linux-amd64.AppImage`;
    renameOne(appimageDir, appOld, appNew);
    renameOne(appimageDir, `${appOld}.sig`, `${appNew}.sig`);
    files.push(...collectWithSig(appimageDir, appNew));

    const sigPath = join(appimageDir, `${appNew}.sig`);
    if (existsSync(sigPath)) {
      updaterPlatform = {
        platform: "linux-x86_64",
        url: `${downloadBase}/${appNew}`,
        signature: readFileSync(sigPath, "utf8").trim(),
      };
    }
  }
} else if (platform === "macos-latest") {
  const dmgDirCandidates = [join(bundleRoot, "dmg"), join(bundleRoot, "macos")];
  const macosDir = join(bundleRoot, "macos");

  for (const dmgDir of dmgDirCandidates) {
    const dmgOld = findFirstFile(dmgDir, (n) => n.endsWith(".dmg") && !n.endsWith(".sig"));
    if (dmgOld) {
      const dmgNew = `${slug}-${version}-macos-aarch64.dmg`;
      renameOne(dmgDir, dmgOld, dmgNew);
      renameOne(dmgDir, `${dmgOld}.sig`, `${dmgNew}.sig`);
      files.push(...collectWithSig(dmgDir, dmgNew));
      break;
    }
  }

  // updater 使用 .app.tar.gz，不是 dmg
  const tarOld = findFirstFile(
    macosDir,
    (n) => n.endsWith(".app.tar.gz") && !n.endsWith(".sig")
  );
  if (tarOld) {
    const tarNew = `${slug}-${version}-macos-aarch64.app.tar.gz`;
    renameOne(macosDir, tarOld, tarNew);
    renameOne(macosDir, `${tarOld}.sig`, `${tarNew}.sig`);
    files.push(...collectWithSig(macosDir, tarNew));

    const sigPath = join(macosDir, `${tarNew}.sig`);
    if (existsSync(sigPath)) {
      updaterPlatform = {
        platform: "darwin-aarch64",
        url: `${downloadBase}/${tarNew}`,
        signature: readFileSync(sigPath, "utf8").trim(),
      };
    }
  } else {
    console.warn("No .app.tar.gz found under macos/; updater artifacts may be missing");
  }
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

if (updaterPlatform) {
  writeFileSync(updaterMetaPath, `${JSON.stringify(updaterPlatform, null, 2)}\n`);
  console.log(`Updater meta: ${updaterPlatform.platform} -> ${basename(updaterPlatform.url)}`);
} else {
  console.warn("Updater platform meta not written (missing signature/bundle)");
  if (existsSync(updaterMetaPath)) {
    writeFileSync(updaterMetaPath, "");
  }
}
