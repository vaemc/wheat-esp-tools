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

/** 信号条 0–100，越近越强 */
export function rssiBarPercent(rssi: number): number {
  const clamped = Math.min(-30, Math.max(-100, rssi));
  return Math.round(((clamped + 100) / 70) * 100);
}

/** 多久前见到（秒） */
export function secondsSince(ts: number): number {
  return Math.max(0, Math.floor((Date.now() - ts) / 1000));
}

/** 新鲜度 0–100，10 秒内衰减 */
export function freshnessPercent(lastSeen: number, ttlSec = 10): number {
  const age = secondsSince(lastSeen);
  return Math.max(0, Math.round((1 - age / ttlSec) * 100));
}

export function displayName(name: string, unknownLabel: string): string {
  const trimmed = name?.trim();
  return trimmed || unknownLabel;
}
