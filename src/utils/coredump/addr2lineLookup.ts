import { invoke } from "@tauri-apps/api/core";
import type { Addr2LineHit } from "./types";

export async function lookupAddr2line(
  elfPath: string,
  addresses: number[]
): Promise<Addr2LineHit[]> {
  if (!elfPath || !addresses.length) {
    return [];
  }
  const unique = [...new Set(addresses.map((a) => a >>> 0))];
  return (await invoke("coredump_addr2line", {
    elfPath,
    addresses: unique,
  })) as Addr2LineHit[];
}
