import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useDeviceStore } from "@/stores/device";

export interface DeviceInfoItem {
  key: string;
  label: string;
  value: string;
  mono?: boolean;
  copy?: boolean;
  primary?: boolean;
}

export function useDeviceInfoDisplay() {
  const { t } = useI18n();
  const store = useDeviceStore();
  const { port, deviceInfo: d } = storeToRefs(store);

  const allItems = computed((): DeviceInfoItem[] => {
    const info = d.value;
    const rows: (DeviceInfoItem | null)[] = [
      info.chipType
        ? { key: "chip", label: t("device.chip"), value: info.chipType, primary: true }
        : null,
      info.mac
        ? {
            key: "mac",
            label: t("device.mac"),
            value: info.mac,
            mono: true,
            copy: true,
            primary: true,
          }
        : null,
      info.flashSize
        ? {
            key: "flash",
            label: t("device.flashSize"),
            value: info.flashSize,
            primary: true,
          }
        : null,
      info.psram
        ? { key: "psram", label: t("device.psram"), value: info.psram, primary: true }
        : null,
      info.crystal
        ? { key: "crystal", label: t("device.crystal"), value: info.crystal, primary: true }
        : null,
      info.revision
        ? { key: "rev", label: t("device.revision"), value: info.revision }
        : null,
      info.chipDetail && info.chipDetail !== info.chipType
        ? {
            key: "detail",
            label: t("device.chipDetail"),
            value: info.chipDetail,
            mono: true,
          }
        : null,
      info.flashManufacturer || info.flashDevice
        ? {
            key: "flashId",
            label: t("device.flashId"),
            value: [info.flashManufacturer, info.flashDevice]
              .filter(Boolean)
              .join(" / "),
            mono: true,
          }
        : null,
      info.flashType
        ? { key: "flashType", label: t("device.flashType"), value: info.flashType }
        : null,
      info.features
        ? { key: "features", label: t("device.features"), value: info.features }
        : null,
      info.security
        ? {
            key: "security",
            label: t("device.security"),
            value: info.security,
            mono: true,
          }
        : null,
    ];
    return rows.filter((r): r is DeviceInfoItem => r !== null && Boolean(r.value));
  });

  const primaryItems = computed(() =>
    allItems.value.filter((item) => item.primary)
  );

  const extraItems = computed(() =>
    allItems.value.filter((item) => !item.primary)
  );

  return {
    store,
    port,
    allItems,
    primaryItems,
    extraItems,
  };
}
