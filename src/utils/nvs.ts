import { invoke } from "@tauri-apps/api/tauri";

export interface NvsKeyValue {
  namespace: string;
  key: string;
  value_type: string;
  value: string;
}

export async function parseNvsPartition(path: string): Promise<NvsKeyValue[]> {
  return invoke<NvsKeyValue[]>("parse_nvs_partition", { path });
}
