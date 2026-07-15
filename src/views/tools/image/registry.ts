/**
 * 图片处理 → 转换工具注册表。
 * 新增工具时：在 tools/ 下建同级目录，并在此登记即可。
 */
import type { Component } from "vue";
import { defineAsyncComponent } from "vue";

export type ImageConverterId = "sjpg" | "eaf";

export interface ImageConverterTool {
  id: ImageConverterId;
  /** MenuIcon 名 */
  icon: string;
  labelKey: string;
  component: Component;
}

export const IMAGE_CONVERTER_TOOLS: ImageConverterTool[] = [
  {
    id: "sjpg",
    icon: "sjpg",
    labelKey: "image.toolSjpg",
    component: defineAsyncComponent(() => import("./tools/sjpg/Workbench.vue")),
  },
  {
    id: "eaf",
    icon: "eaf",
    labelKey: "image.toolEaf",
    component: defineAsyncComponent(() => import("./tools/eaf/Workbench.vue")),
  },
];

export function getImageConverterTool(
  id: ImageConverterId
): ImageConverterTool | undefined {
  return IMAGE_CONVERTER_TOOLS.find((tool) => tool.id === id);
}
