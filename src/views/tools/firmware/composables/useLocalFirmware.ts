import { computed, ref } from "vue";
import prettyBytes from "pretty-bytes";
import {
  getCurrentDir,
  getFirmwareList,
  getFileInfo,
  removeFile,
} from "@/utils/common";
import { basename } from "@/utils/path";

export interface LocalFirmwareItem {
  key: string;
  path: string;
  title: string;
  description: string;
  sizeLabel: string;
}

async function toListItem(path: string): Promise<LocalFirmwareItem> {
  let sizeLabel = "";
  try {
    const info = await getFileInfo(path);
    sizeLabel = prettyBytes(info.len);
  } catch {
    sizeLabel = "";
  }
  return {
    key: path,
    path,
    title: basename(path),
    description: sizeLabel,
    sizeLabel,
  };
}

export function useLocalFirmware() {
  const items = ref<LocalFirmwareItem[]>([]);
  const keyword = ref("");
  const loading = ref(true);
  const firmwareDir = ref("");

  const filteredItems = computed(() => {
    const q = keyword.value.trim().toLowerCase();
    if (!q) {
      return items.value;
    }
    return items.value.filter((item) =>
      item.title.toLowerCase().includes(q)
    );
  });

  async function refresh() {
    loading.value = true;
    try {
      const dir = await getCurrentDir();
      firmwareDir.value = `${dir}\\firmware`;
      const paths = await getFirmwareList();
      items.value = await Promise.all(paths.map(toListItem));
    } finally {
      loading.value = false;
    }
  }

  async function remove(path: string) {
    await removeFile(path);
    await refresh();
  }

  refresh();

  return {
    items,
    keyword,
    filteredItems,
    loading,
    firmwareDir,
    refresh,
    remove,
  };
}
