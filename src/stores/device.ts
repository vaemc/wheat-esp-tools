import { defineStore } from "pinia";
import { getSerialPortList } from "@/utils/common";
import {
  EMPTY_DEVICE_INFO,
  fetchDeviceInfo,
  type EspDeviceInfo,
} from "@/utils/esptoolDevice";

export const useDeviceStore = defineStore("device", {
  state: () => ({
    port: (localStorage.getItem("port") ?? "") as string,
    portOptions: [] as { label: string; value: string }[],
    deviceInfo: { ...EMPTY_DEVICE_INFO } as EspDeviceInfo,
    loadingPorts: false,
    loadingInfo: false,
  }),

  actions: {
    async refreshPortList() {
      this.loadingPorts = true;
      try {
        const list = await getSerialPortList();
        this.portOptions = list.map((item) => ({
          value: item,
          label: item,
        }));

        if (this.port && !list.includes(this.port)) {
          this.port = "";
          localStorage.removeItem("port");
        }

        if (!this.port && list.length > 0) {
          const saved = localStorage.getItem("port");
          const next = saved && list.includes(saved) ? saved : list[0];
          this.port = next;
          localStorage.setItem("port", next);
        }
      } finally {
        this.loadingPorts = false;
      }
    },

    setPort(port: string) {
      this.port = port;
      localStorage.setItem("port", port);
      this.deviceInfo = { ...EMPTY_DEVICE_INFO };
    },

    clearPort() {
      this.port = "";
      this.deviceInfo = { ...EMPTY_DEVICE_INFO };
      localStorage.removeItem("port");
    },

    async refreshDeviceInfo() {
      if (!this.port) {
        this.deviceInfo = { ...EMPTY_DEVICE_INFO };
        return;
      }

      this.loadingInfo = true;
      try {
        this.deviceInfo = await fetchDeviceInfo(this.port);
      } catch {
        this.deviceInfo = { ...EMPTY_DEVICE_INFO };
      } finally {
        this.loadingInfo = false;
      }
    },
  },
});
