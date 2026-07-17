/**
 * 应用内更新：Tauri updater + GitHub Releases latest.json
 */
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
}

export async function getAppVersion(): Promise<string> {
  return getVersion();
}

/** 展示用版本号统一加 v 前缀（已有则不重复） */
export function formatAppVersion(version: string | null | undefined): string {
  if (!version || version === "—") {
    return version || "—";
  }
  return /^v/i.test(version) ? version : `v${version}`;
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
      },
      update: null,
    };
  }

  return {
    info: {
      currentVersion,
      latestVersion: update.version,
      hasUpdate: true,
    },
    update,
  };
}

/**
 * 下载并安装更新。
 * @returns 是否已触发重启（relaunch 成功）
 */
export async function downloadAndInstallUpdate(
  update: Update,
  onProgress?: (percent: number | null) => void
): Promise<{ relaunched: boolean }> {
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

  try {
    await relaunch();
    return { relaunched: true };
  } catch (error) {
    console.error("[update] relaunch failed:", error);
    return { relaunched: false };
  }
}
