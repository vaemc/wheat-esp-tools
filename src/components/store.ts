import { defineStore } from "pinia";
import { Path } from "./tools/model";
export const portStore = defineStore("portStore", {
  state: () => ({
    port: "",
  }),
});

export const historyPathStore = defineStore("historyPath", {
  state: () => ({
    pathList: [] as Path[],
  }),
  persist: true,
});
