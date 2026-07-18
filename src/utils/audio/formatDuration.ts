/**
 * 时长格式：m:ss.SS（秒带两位小数），如 0:05.04
 */
export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) {
    return "0:00.00";
  }
  const totalCs = Math.round(sec * 100);
  const m = Math.floor(totalCs / 6000);
  const s = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
