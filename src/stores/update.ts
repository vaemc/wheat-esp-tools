import { computed, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import { message, Modal } from "ant-design-vue";
import i18n from "@/locales/i18n";
import type { Update } from "@tauri-apps/plugin-updater";
import {
  checkForAppUpdate,
  downloadAndInstallUpdate,
  formatAppVersion,
  getAppVersion,
  type UpdateCheckResult,
} from "@/utils/updateCheck";

const MESSAGE_KEY = "app-update";

function t(key: string, values?: Record<string, unknown>) {
  return i18n.global.t(key, values as Record<string, string>);
}

/** 应用更新：全局单例，切换页面后下载仍继续 */
export const useUpdateStore = defineStore("update", () => {
  const loadingVersion = ref(false);
  const checking = ref(false);
  const installing = ref(false);
  const installPercent = ref<number | null>(null);
  const currentVersion = ref("");
  const result = ref<UpdateCheckResult | null>(null);
  /** Update 含 #private，必须用 shallowRef */
  const pendingUpdate = shallowRef<Update | null>(null);

  let versionLoaded = false;
  let confirmOpen = false;
  let lastProgressToastAt = 0;

  const statusText = computed(() => {
    if (installing.value) {
      if (installPercent.value == null) {
        return t("settings.updateInstalling");
      }
      return t("settings.updateInstallingProgress", {
        percent: installPercent.value,
      });
    }
    if (loadingVersion.value && !currentVersion.value) {
      return t("settings.versionLoading");
    }
    const versionLabel = formatAppVersion(currentVersion.value || "—");
    if (!result.value) {
      return versionLabel;
    }
    if (result.value.hasUpdate && result.value.latestVersion) {
      return `${versionLabel} · ${t("settings.updateAvailable", {
        version: formatAppVersion(result.value.latestVersion),
      })}`;
    }
    return `${versionLabel} · ${t("settings.updateLatest", {
      version: formatAppVersion(
        result.value.latestVersion || currentVersion.value || "—"
      ),
    })}`;
  });

  function setInstallProgressMessage(percent: number | null, force = false) {
    const now = Date.now();
    // 进度 toast 节流，避免每个 chunk 都刷新
    if (
      !force &&
      percent != null &&
      percent < 100 &&
      now - lastProgressToastAt < 200
    ) {
      return;
    }
    lastProgressToastAt = now;
    message.loading({
      content:
        percent == null
          ? t("settings.updateInstalling")
          : t("settings.updateInstallingProgress", { percent }),
      key: MESSAGE_KEY,
      duration: 0,
    });
  }

  function resetInstallState() {
    installing.value = false;
    installPercent.value = null;
  }

  async function loadCurrentVersion(force = false) {
    if (loadingVersion.value) {
      return;
    }
    if (versionLoaded && !force && currentVersion.value) {
      return;
    }
    loadingVersion.value = true;
    try {
      currentVersion.value = await getAppVersion();
      versionLoaded = true;
    } catch (error) {
      console.error("[update] getVersion failed:", error);
      currentVersion.value = "—";
      versionLoaded = false;
    } finally {
      loadingVersion.value = false;
    }
  }

  async function installNow(update: Update) {
    if (installing.value) {
      return;
    }
    installing.value = true;
    installPercent.value = 0;
    lastProgressToastAt = 0;
    setInstallProgressMessage(0, true);
    try {
      const { relaunched } = await downloadAndInstallUpdate(update, (percent) => {
        installPercent.value = percent;
        setInstallProgressMessage(percent, percent === 100);
      });
      if (relaunched) {
        message.success({
          content: t("settings.updateInstallDone"),
          key: MESSAGE_KEY,
        });
        return;
      }
      // 已安装但重启失败：保持 installing=false，提示手动重启
      message.warning({
        content: t("settings.updateRelaunchFailed"),
        key: MESSAGE_KEY,
        duration: 8,
      });
      resetInstallState();
      pendingUpdate.value = null;
      if (result.value) {
        result.value = { ...result.value, hasUpdate: false };
      }
    } catch (error) {
      console.error("[update] install failed:", error);
      message.error({
        content: t("settings.updateInstallFailed"),
        key: MESSAGE_KEY,
      });
      resetInstallState();
    }
  }

  function confirmAndInstall(update: Update, version: string) {
    if (installing.value || confirmOpen) {
      return;
    }
    confirmOpen = true;
    Modal.confirm({
      title: t("settings.updateConfirmTitle"),
      content: t("settings.updateConfirmBody", {
        version: formatAppVersion(version),
      }),
      okText: t("settings.updateConfirmOk"),
      cancelText: t("settings.cancel"),
      afterClose: () => {
        confirmOpen = false;
      },
      onOk: () => {
        // 不 await：关闭弹窗后后台继续下载，切换页面也不中断
        void installNow(update);
      },
    });
  }

  async function checkUpdate() {
    if (installing.value || checking.value) {
      return;
    }
    checking.value = true;
    try {
      const { info, update } = await checkForAppUpdate();
      result.value = info;
      currentVersion.value = info.currentVersion;
      versionLoaded = true;

      if (!info.hasUpdate || !update || !info.latestVersion) {
        pendingUpdate.value = null;
        message.success(
          t("settings.updateLatest", {
            version: formatAppVersion(
              info.latestVersion || info.currentVersion
            ),
          })
        );
        return;
      }

      pendingUpdate.value = update;
      confirmAndInstall(update, info.latestVersion);
    } catch (error) {
      console.error("[update] check failed:", error);
      // 失败时保留已有 pendingUpdate，避免「立即升级」变成空按钮
      const msg = error instanceof Error ? error.message : String(error);
      if (/404|not found|failed to fetch|network|valid release JSON/i.test(msg)) {
        message.error(t("settings.updateNoManifest"));
      } else {
        message.error(t("settings.updateCheckFailed"));
      }
    } finally {
      checking.value = false;
    }
  }

  function upgradeNow() {
    const update = pendingUpdate.value;
    const version = result.value?.latestVersion;
    if (!update || !version || installing.value) {
      return;
    }
    confirmAndInstall(update, version);
  }

  return {
    checking,
    installing,
    result,
    statusText,
    loadCurrentVersion,
    checkUpdate,
    upgradeNow,
  };
});
