import { defineStore } from "pinia";
import { basename, getProjectLabel } from "@/utils/path";

export interface HistoryPathItem {
  key: string;
  path: string;
  title: string;
  description: string;
  configType: "idf" | "pio";
}

function toHistoryItem(path: string): HistoryPathItem {
  const name = basename(path);
  const configType = name === "idedata.json" ? "pio" : "idf";
  return {
    key: path,
    path,
    title: getProjectLabel(path),
    description: path,
    configType,
  };
}

export const useHistoryStore = defineStore("history", {
  state: () => ({
    paths: [] as string[],
    keyword: "",
  }),

  getters: {
    items(state): HistoryPathItem[] {
      return state.paths.map(toHistoryItem);
    },

    filteredItems(state): HistoryPathItem[] {
      const q = state.keyword.trim().toLowerCase();
      const items = state.paths.map(toHistoryItem);
      if (!q) {
        return items;
      }
      return items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.path.toLowerCase().includes(q)
      );
    },
  },

  actions: {
    addPath(path: string) {
      if (!this.paths.includes(path)) {
        this.paths.unshift(path);
      }
    },

    removePath(path: string) {
      this.paths = this.paths.filter((item) => item !== path);
    },
  },

  persist: true,
});
