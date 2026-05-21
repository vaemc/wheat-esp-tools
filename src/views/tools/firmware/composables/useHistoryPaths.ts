import { computed, ref } from "vue";
import db from "@/db/db";
import { basename, getProjectLabel } from "@/utils/path";

export interface HistoryPathItem {
  key: string;
  path: string;
  title: string;
  description: string;
  configType: "idf" | "pio";
}

async function loadPaths(): Promise<HistoryPathItem[]> {
  const records = await db.getAll("paths");
  return records.map((item: { path: string }) => {
    const name = basename(item.path);
    const configType = name === "idedata.json" ? "pio" : "idf";
    return {
      key: item.path,
      path: item.path,
      title: getProjectLabel(item.path),
      description: item.path,
      configType,
    };
  });
}

export function useHistoryPaths() {
  const items = ref<HistoryPathItem[]>([]);
  const keyword = ref("");
  const loading = ref(true);

  const filteredItems = computed(() => {
    const q = keyword.value.trim().toLowerCase();
    if (!q) {
      return items.value;
    }
    return items.value.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q)
    );
  });

  async function refresh() {
    loading.value = true;
    try {
      items.value = await loadPaths();
    } finally {
      loading.value = false;
    }
  }

  async function remove(path: string) {
    await db.delete("paths", path);
    await refresh();
  }

  refresh();

  return {
    items,
    keyword,
    filteredItems,
    loading,
    refresh,
    remove,
  };
}
