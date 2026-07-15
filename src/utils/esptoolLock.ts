/** 全应用 esptool 互斥：keep-alive 多页也不能并行抢串口 */
let busy = false;

export function isEsptoolBusy(): boolean {
  return busy;
}

export async function withEsptoolLock<T>(fn: () => Promise<T>): Promise<T> {
  if (busy) {
    throw new Error("ESPTOOL_BUSY");
  }
  busy = true;
  try {
    return await fn();
  } finally {
    busy = false;
  }
}
