import { defineStore } from "pinia";
import { basename } from "@/utils/path";

const MAX_HISTORY = 20;

export interface ElfHistoryItem {
  path: string;
  name: string;
}

export const useElfHistoryStore = defineStore("elfHistory", {
  state: () => ({
    paths: [] as string[],
  }),

  getters: {
    items(state): ElfHistoryItem[] {
      return state.paths.map((path) => ({
        path,
        name: basename(path),
      }));
    },
  },

  actions: {
    addPath(path: string) {
      const normalized = path.trim();
      if (!normalized) {
        return;
      }
      this.paths = [normalized, ...this.paths.filter((p) => p !== normalized)].slice(
        0,
        MAX_HISTORY
      );
    },

    removePath(path: string) {
      this.paths = this.paths.filter((p) => p !== path);
    },

    clearAll() {
      this.paths = [];
    },
  },

  persist: {
    pick: ["paths"],
  },
});
