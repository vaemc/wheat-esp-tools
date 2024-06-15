import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { Firmware } from "@/model/model";

export const useFirmwareListStore = defineStore("FirmwareList", {
  state: () => {
    return {
      firmwareList: ref([] as Firmware[]),
    };
  },
  persist: true,
});

// export default defineStore('FirmwareList', () => {
// 	const list = ref([] as Firmware[])
// }, {
//   persist: true
// })
