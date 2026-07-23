import type { PetUsbAnnouncePayload } from "./types";

/** 格式化设备管理器风格的一行：友好名 (COMx) */
export function formatPortLine(port: {
  portName: string;
  friendlyName?: string | null;
  description?: string | null;
}): string {
  const label =
    (port.friendlyName && port.friendlyName.trim()) ||
    (port.description && port.description.trim()) ||
    "";
  if (!label) return port.portName;
  if (label.includes(port.portName)) return label;
  return `${label} (${port.portName})`;
}

export function buildUsbAnnounceText(
  payload: PetUsbAnnouncePayload,
  lang: "zh" | "en"
): string {
  const lines = payload.ports.map(formatPortLine);
  if (lang === "en") {
    const head =
      payload.added.length === 1
        ? `New USB serial: ${payload.added[0]}`
        : `New USB serials: ${payload.added.join(", ")}`;
    if (lines.length === 0) return `${head}\nNo ports right now.`;
    return `${head}\nCurrent ports:\n${lines.map((l) => `· ${l}`).join("\n")}`;
  }
  const head =
    payload.added.length === 1
      ? `发现新串口：${payload.added[0]}`
      : `发现新串口：${payload.added.join("、")}`;
  if (lines.length === 0) return `${head}\n目前没有端口。`;
  return `${head}\n目前有：\n${lines.map((l) => `· ${l}`).join("\n")}`;
}
