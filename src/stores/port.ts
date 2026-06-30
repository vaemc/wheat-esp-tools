import { defineStore } from "pinia";

export const usePortStore = defineStore("port", {
  state: () => ({
    selectedPort: "",
  }),
  persist: true,
});
