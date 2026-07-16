import { computed, onMounted, ref, shallowRef } from "vue";
import { message, Modal } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import type { Update } from "@tauri-apps/plugin-updater";
import {
  checkForAppUpdate,
  downloadAndInstallUpdate,
  getAppVersion,
  type UpdateCheckResult,
} from "@/utils/updateCheck";

/** 设置页 · 当前版本 + 检测更新 / 静默安装 */
export function useUpdateCheck() {
  const { t } = useI18n();
  const loadingVersion = ref(false);
  const checking = ref(false);
  const installing = ref(false);
  const installPercent = ref<number | null>(null);
  const currentVersion = ref("");
  const result = ref<UpdateCheckResult | null>(null);
  const checked = ref(false);
  /** Update 含 #private，必须用 shallowRef，不能放进深层 reactive */
  const pendingUpdate = shallowRef<Update | null>(null);

  const statusText = computed(() => {
    if (installing.value) {
      if (installPercent.value == null) {
        return t("settings.updateInstalling");
      }
      return t("settings.updateInstallingProgress", {
        percent: installPercent.value,
      });
    }
    if (!checked.value || !result.value) {
      return t("settings.updateHint");
    }
    if (result.value.hasUpdate && result.value.latestVersion) {
      return t("settings.updateAvailable", {
        version: result.value.latestVersion,
      });
    }
    return t("settings.updateLatest", {
      version: result.value.latestVersion || currentVersion.value || "—",
    });
  });

  async function loadCurrentVersion() {
    loadingVersion.value = true;
    try {
      currentVersion.value = await getAppVersion();
    } catch (error) {
      console.error("[settings/update] getVersion failed:", error);
      currentVersion.value = "—";
    } finally {
      loadingVersion.value = false;
    }
  }

  async function installNow(update: Update) {
    installing.value = true;
    installPercent.value = 0;
    try {
      message.loading({
        content: t("settings.updateInstalling"),
        key: "app-update",
        duration: 0,
      });
      await downloadAndInstallUpdate(update, (percent) => {
        installPercent.value = percent;
      });
      message.success({
        content: t("settings.updateInstallDone"),
        key: "app-update",
      });
    } catch (error) {
      console.error("[settings/update] install failed:", error);
      message.error({
        content: t("settings.updateInstallFailed"),
        key: "app-update",
      });
    } finally {
      installing.value = false;
      installPercent.value = null;
      pendingUpdate.value = null;
    }
  }

  function confirmAndInstall(update: Update, version: string) {
    Modal.confirm({
      title: t("settings.updateConfirmTitle"),
      content: t("settings.updateConfirmBody", { version }),
      okText: t("settings.updateConfirmOk"),
      cancelText: t("settings.cancel"),
      onOk: () => installNow(update),
    });
  }

  async function checkUpdate() {
    if (installing.value) {
      return;
    }
    checking.value = true;
    pendingUpdate.value = null;
    try {
      const { info, update } = await checkForAppUpdate();
      result.value = info;
      checked.value = true;
      currentVersion.value = info.currentVersion;

      if (!info.hasUpdate || !update || !info.latestVersion) {
        message.success(
          t("settings.updateLatest", {
            version: info.latestVersion || info.currentVersion,
          })
        );
        return;
      }

      pendingUpdate.value = update;
      message.success(
        t("settings.updateAvailable", { version: info.latestVersion })
      );
      confirmAndInstall(update, info.latestVersion);
    } catch (error) {
      console.error("[settings/update] check failed:", error);
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

  onMounted(() => {
    void loadCurrentVersion();
  });

  return {
    loadingVersion,
    checking,
    installing,
    installPercent,
    currentVersion,
    result,
    checked,
    statusText,
    loadCurrentVersion,
    checkUpdate,
    upgradeNow,
  };
}
