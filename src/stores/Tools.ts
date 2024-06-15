import { ref, computed } from "vue";
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

// export default defineStore('FirmwareList', () => {
// 	const list = ref([] as Firmware[])
// }, {
//   persist: true
// })
