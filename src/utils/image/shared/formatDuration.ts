/** 格式化秒数为可读时长（如 `4.2s` / `1m05s`）。 */
export function formatDurationSec(
  sec: number,
  empty = ""
): string {
  if (!Number.isFinite(sec) || sec <= 0) {
    return empty;
  }
  if (sec < 60) {
    return `${sec.toFixed(1)}s`;
  }
  const m = Math.floor(sec / 60);
  const s = Math.round(sec - m * 60);
  return `${m}m${String(s).padStart(2, "0")}s`;
}

/** 由逐帧 delay 或平均值估算总时长（秒）。 */
export function durationSecFromDelays(
  delaysMs: number[] | undefined,
  frameCount: number,
  delayAvgMs: number
): number {
  if (delaysMs && delaysMs.length > 0) {
    return delaysMs.reduce((a, b) => a + b, 0) / 1000;
  }
  if (frameCount > 0 && delayAvgMs > 0) {
    return (frameCount * delayAvgMs) / 1000;
  }
  return 0;
}
