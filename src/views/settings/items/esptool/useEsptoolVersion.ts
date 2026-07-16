import { onMounted, ref } from "vue";
import { fetchEsptoolVersion } from "@/utils/esptoolVersion";

/** 设置页 · esptool 版本 */
export function useEsptoolVersionItem() {
  const loading = ref(false);
  const version = ref<string | null>(null);

  async function refresh() {
    loading.value = true;
    try {
      version.value = await fetchEsptoolVersion();
    } catch (error) {
      console.error("[settings/esptool] version failed:", error);
      version.value = null;
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => {
    void refresh();
  });

  return {
    loading,
    version,
    refresh,
  };
}
