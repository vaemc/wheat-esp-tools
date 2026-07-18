import { defineStore } from "pinia";

const MAX_HISTORY = 20;

function fileNameOf(path: string) {
  return path.split(/[/\\]/).pop() ?? path;
}

export interface FontHistoryItem {
  path: string;
  name: string;
}

export const useFontHistoryStore = defineStore("fontHistory", {
  state: () => ({
    paths: [] as string[],
    /** 点击历史项时写入；Workbench 加载后清空（不持久化语义，启动时忽略） */
    activatePath: null as string | null,
  }),

  getters: {
    items(state): FontHistoryItem[] {
      return state.paths.map((path) => ({
        path,
        name: fileNameOf(path),
      }));
    },
  },

  actions: {
    addPath(path: string) {
      const normalized = path.trim();
      if (!normalized) {
        return;
      }
      this.paths = [
        normalized,
        ...this.paths.filter((p) => p !== normalized),
      ].slice(0, MAX_HISTORY);
    },

    /** 点击历史：置顶并通知 Workbench 加载 */
    usePath(path: string) {
      this.addPath(path);
      this.activatePath = path;
    },

    clearActivate() {
      this.activatePath = null;
    },

    removePath(path: string) {
      this.paths = this.paths.filter((p) => p !== path);
      if (this.activatePath === path) {
        this.activatePath = null;
      }
    },

    clearAll() {
      this.paths = [];
      this.activatePath = null;
    },
  },

  persist: true,
});
