import { defineStore } from "pinia";
import { getSerialPortList } from "@/utils/common";
import {
  EMPTY_DEVICE_INFO,
  fetchDeviceInfo,
  type EspDeviceInfo,
} from "@/utils/esptoolDevice";
import { usePortStore } from "@/stores/port";

export const useDeviceStore = defineStore("device", {
  state: () => ({
    portOptions: [] as { label: string; value: string }[],
    deviceInfo: { ...EMPTY_DEVICE_INFO } as EspDeviceInfo,
    loadingPorts: false,
    loadingInfo: false,
  }),

  actions: {
    async refreshPortList(pickDefault = false) {
      const portStore = usePortStore();
      this.loadingPorts = true;
      try {
        const list = await getSerialPortList();
        this.portOptions = list.map((item) => ({
          value: item,
          label: item,
        }));

        if (portStore.selectedPort && !list.includes(portStore.selectedPort)) {
          portStore.selectedPort = "";
        }

        if (
          pickDefault &&
          !portStore.selectedPort &&
          list.length > 0
        ) {
          portStore.selectedPort = list[0];
        }
      } finally {
        this.loadingPorts = false;
      }
    },

    onPortChange(port: string) {
      usePortStore().selectedPort = port;
      this.deviceInfo = { ...EMPTY_DEVICE_INFO };
    },

    clearPort() {
      usePortStore().selectedPort = "";
      this.deviceInfo = { ...EMPTY_DEVICE_INFO };
    },

    async refreshDeviceInfo() {
      const port = usePortStore().selectedPort;
      if (!port) {
        this.deviceInfo = { ...EMPTY_DEVICE_INFO };
        return;
      }

      this.loadingInfo = true;
      try {
        this.deviceInfo = await fetchDeviceInfo(port);
      } catch {
        this.deviceInfo = { ...EMPTY_DEVICE_INFO };
      } finally {
        this.loadingInfo = false;
      }
    },
  },
});
