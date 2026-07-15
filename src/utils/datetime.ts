function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `YYYY-MM-DD HH:mm:ss` */
export function formatDateTime(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

/** `YYYYMMDDHHmmss`，用于文件名 */
export function formatCompactTimestamp(date: Date = new Date()): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
}

export function nowMs(): number {
  return Date.now();
}
