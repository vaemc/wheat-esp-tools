/**
 * 应用内更新：Tauri updater + GitHub Releases latest.json
 */
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export const GITHUB_REPO = "vaemc/wheat-esp-tools";
export const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  body: string | null;
  date: string | null;
}

export async function getAppVersion(): Promise<string> {
  return getVersion();
}

/** 检查更新；有更新时一并返回原始 Update 句柄（勿放入深层 reactive） */
export async function checkForAppUpdate(): Promise<{
  info: UpdateCheckResult;
  update: Update | null;
}> {
  const currentVersion = await getAppVersion();
  const update = await check();

  if (!update) {
    return {
      info: {
        currentVersion,
        latestVersion: currentVersion,
        hasUpdate: false,
        body: null,
        date: null,
      },
      update: null,
    };
  }

  return {
    info: {
      currentVersion,
      latestVersion: update.version,
      hasUpdate: true,
      body: update.body ?? null,
      date: update.date ?? null,
    },
    update,
  };
}

/** 下载并静默安装，然后重启 */
export async function downloadAndInstallUpdate(
  update: Update,
  onProgress?: (percent: number | null) => void
): Promise<void> {
  let downloaded = 0;
  let contentLength: number | null = null;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        contentLength = event.data.contentLength ?? null;
        onProgress?.(contentLength ? 0 : null);
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        if (contentLength && contentLength > 0) {
          onProgress?.(
            Math.min(99, Math.round((downloaded / contentLength) * 100))
          );
        } else {
          onProgress?.(null);
        }
        break;
      case "Finished":
        onProgress?.(100);
        break;
    }
  });

  await relaunch();
}
