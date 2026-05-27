import { invoke } from "@tauri-apps/api/tauri";

export interface NvsKeyValue {
  namespace: string;
  key: string;
  value_type: string;
  value: string;
  /** Rust 端解析出的二进制条目，前端用于禁止内联编辑 */
  is_binary: boolean;
}

export interface NvsEdit {
  /** 操作类型：更新 / 删除 / 新增 */
  op: "update" | "delete" | "add";
  namespace: string;
  key: string;
  value_type?: string;
  value?: string;
}

export interface NvsRebuildSummary {
  save_path: string;
  written_size: number;
  entries: number;
}

export async function parseNvsPartition(path: string): Promise<NvsKeyValue[]> {
  return invoke<NvsKeyValue[]>("parse_nvs_partition", { path });
}

/** 在已有 NVS 二进制基础上应用编辑，重新生成等大小分区文件 */
export async function rebuildNvsPartition(args: {
  sourcePath: string;
  edits: NvsEdit[];
  size: number;
  savePath: string;
}): Promise<NvsRebuildSummary> {
  return invoke<NvsRebuildSummary>("rebuild_nvs_partition", {
    sourcePath: args.sourcePath,
    edits: args.edits,
    size: args.size,
    savePath: args.savePath,
  });
}

/** 从 ESP-IDF 标准 NVS CSV 直接生成新的 NVS 二进制 */
export async function generateNvsFromCsv(args: {
  csvPath: string;
  size: number;
  savePath: string;
}): Promise<NvsRebuildSummary> {
  return invoke<NvsRebuildSummary>("generate_nvs_from_csv", {
    csvPath: args.csvPath,
    size: args.size,
    savePath: args.savePath,
  });
}
