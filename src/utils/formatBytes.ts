const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/**
 * 格式化字节大小（1024 进制），用于固件 / 缓存 / 媒体等体积展示。
 * 例：1337 → "1.31 KB"，1024 * 1024 → "1 MB"
 */
export function formatBytes(bytes: number, fractionDigits = 2): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const exp = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1
  );
  const value = bytes / 1024 ** exp;

  if (exp === 0) {
    return `${Math.round(value)} B`;
  }

  return `${Number(value.toFixed(fractionDigits))} ${UNITS[exp]}`;
}
