import { invoke } from "@tauri-apps/api/core";

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

/**
 * 在已有 NVS 二进制上应用编辑，重新生成等大小分区文件。
 * 目标大小由 Rust 端按源文件长度决定，调用方无需再传 size。
 */
export async function rebuildNvsPartition(args: {
  sourcePath: string;
  edits: NvsEdit[];
  savePath: string;
}): Promise<NvsRebuildSummary> {
  return invoke<NvsRebuildSummary>("rebuild_nvs_partition", {
    sourcePath: args.sourcePath,
    edits: args.edits,
    savePath: args.savePath,
  });
}
