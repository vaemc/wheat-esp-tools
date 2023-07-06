import { defineStore } from "pinia";
import { HistoryPath } from "../utils/model";
export const portStore = defineStore("portStore", {
  state: () => ({
    port: "",
  }),
});

export const historyPathStore = defineStore("historyPath", {
  state: () => ({
    pathList: [] as HistoryPath[],
  }),
  persist: true,
});
