import { defineStore } from "pinia";
import { Firmware } from "@/model/model";

export const useToolsStore = defineStore("tools", {
  state: () => {
    return {
      firmwareList: [] as Firmware[],
      selectedChipType: "",
    };
  },
  persist: true,
});

