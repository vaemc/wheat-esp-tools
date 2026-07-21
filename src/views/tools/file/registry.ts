/**
 * 文件处理 → 工具注册表。
 * 新增工具时：在 tools/ 下建同级目录，并在此登记即可。
 */
import type { Component } from "vue";
import { defineAsyncComponent } from "vue";

export type FileConverterId = "mmap_spiffs";

export interface FileConverterTool {
  id: FileConverterId;
  /** MenuIcon 名 */
  icon: string;
  labelKey: string;
  component: Component;
}

export const FILE_CONVERTER_TOOLS: FileConverterTool[] = [
  {
    id: "mmap_spiffs",
    icon: "mmap_spiffs",
    labelKey: "file.toolMmapSpiffs",
    component: defineAsyncComponent(
      () => import("./tools/mmap_spiffs/Workbench.vue")
    ),
  },
];

export function getFileConverterTool(
  id: FileConverterId
): FileConverterTool | undefined {
  return FILE_CONVERTER_TOOLS.find((tool) => tool.id === id);
}
