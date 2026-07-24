import { useEspflashStore } from "@/stores/espflash";

/** 全应用 Flash 互斥状态（与 Rust 侧锁配合） */
export function isEsptoolBusy(): boolean {
  return useEspflashStore().busy;
}

export async function withEsptoolLock<T>(fn: () => Promise<T>): Promise<T> {
  const store = useEspflashStore();
  if (store.busy) {
    throw new Error("ESPFLASH_BUSY");
  }
  return fn();
}
