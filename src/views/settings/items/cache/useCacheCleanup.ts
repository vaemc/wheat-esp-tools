import { computed, onMounted, ref } from "vue";
import { message, Modal } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import prettyBytes from "pretty-bytes";
import { openDirectoryInExplorer } from "@/utils/common";
import {
  calcDirSizeBytes,
  clearDirContents,
  getTempWorkRoot,
} from "@/utils/tempWorkDir";

/** 设置页 · 缓存清理：仅清理临时工作目录，不动 firmware 固件 */
export function useCacheCleanup() {
  const { t } = useI18n();
  const loading = ref(false);
  const clearing = ref(false);
  const totalBytes = ref(0);
  const tempRoot = ref("");

  const sizeLabel = computed(() => prettyBytes(totalBytes.value));

  async function refresh() {
    loading.value = true;
    try {
      const tmp = await getTempWorkRoot();
      tempRoot.value = tmp;
      totalBytes.value = await calcDirSizeBytes(tmp);
    } catch (error) {
      console.error("[settings/cache] refresh failed:", error);
      message.error(t("settings.cacheRefreshFailed"));
    } finally {
      loading.value = false;
    }
  }

  async function openFolder() {
    try {
      await openDirectoryInExplorer(tempRoot.value || (await getTempWorkRoot()));
    } catch (error) {
      console.error("[settings/cache] open failed:", error);
      message.error(t("settings.cacheOpenFailed"));
    }
  }

  function clearCache() {
    Modal.confirm({
      title: t("settings.cacheClearConfirmTitle"),
      content: t("settings.cacheClearConfirmBody"),
      okText: t("settings.cacheClear"),
      okType: "danger",
      cancelText: t("settings.cancel"),
      async onOk() {
        clearing.value = true;
        try {
          const tmp = tempRoot.value || (await getTempWorkRoot());
          await clearDirContents(tmp);
          message.success(t("settings.cacheClearSuccess"));
          await refresh();
        } catch (error) {
          console.error("[settings/cache] clear failed:", error);
          message.error(t("settings.cacheClearFailed"));
        } finally {
          clearing.value = false;
        }
      },
    });
  }

  onMounted(() => {
    void refresh();
  });

  return {
    loading,
    clearing,
    totalBytes,
    sizeLabel,
    refresh,
    openFolder,
    clearCache,
  };
}
