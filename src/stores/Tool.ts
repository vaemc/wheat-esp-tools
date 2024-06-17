import { defineStore } from "pinia";
import { Firmware } from "@/model/model";
import { RouteRecordName } from "vue-router";
export const useToolsStore = defineStore("tools", {
  state: () => {
    return {
      firmwareList: [] as Firmware[],
      selectedChipType: "",
      selectedKeys: [] as (RouteRecordName | null | undefined)[],
    };
  },
  persist: true,
});
