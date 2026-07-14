import i18n from "@/locales/i18n";

const MANUFACTURER_NAMES: Record<number, string> = {
  0x004c: "Apple",
  0x0059: "Nordic",
  0x00e0: "Google",
  0x0e75: "Espressif",
  0x02e5: "Espressif",
  0x0075: "Samsung",
  0x0006: "Microsoft",
};

export function bytesToHex(bytes: number[], sep = " "): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(sep);
}

export function formatManufacturerId(key: string): string {
  const id = Number.parseInt(key, 10);
  if (Number.isNaN(id)) {
    return key;
  }
  const name = MANUFACTURER_NAMES[id];
  return name ? `${name} (0x${id.toString(16).padStart(4, "0")})` : `0x${id.toString(16).padStart(4, "0")}`;
}

export type RssiLevel = "excellent" | "good" | "fair" | "weak";

export function rssiLevel(rssi: number): RssiLevel {
  if (rssi >= -50) {
    return "excellent";
  }
  if (rssi >= -65) {
    return "good";
  }
  if (rssi >= -80) {
    return "fair";
  }
  return "weak";
}

export function rssiColor(rssi: number): string {
  const map: Record<RssiLevel, string> = {
    excellent: "#52c41a",
    good: "#73d13d",
    fair: "#faad14",
    weak: "#ff4d4f",
  };
  return map[rssiLevel(rssi)];
}

/** 多久前见到（秒） */
export function secondsSince(ts: number): number {
  return Math.max(0, Math.floor((Date.now() - ts) / 1000));
}

export function displayName(name: string, unknownLabel: string): string {
  const trimmed = name?.trim();
  return trimmed || unknownLabel;
}

/** `_tick` 仅用于驱动模板刷新，不参与计算 */
export function formatAgoShort(lastSeen: number, _tick: number): string {
  void _tick;
  const sec = secondsSince(lastSeen);
  if (sec <= 0) {
    return i18n.global.t("ble.justNow");
  }
  return i18n.global.t("ble.secondsAgo", { n: sec });
}
