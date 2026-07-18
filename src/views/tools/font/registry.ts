/**
 * 字体处理 → 转换工具注册表。
 * 新增工具时：在 tools/ 下建同级目录，并在此登记即可。
 */
import type { Component } from "vue";
import { defineAsyncComponent } from "vue";

export type FontConverterId = "lvglfont";

export interface FontConverterTool {
  id: FontConverterId;
  /** MenuIcon 名 */
  icon: string;
  labelKey: string;
  component: Component;
}

export const FONT_CONVERTER_TOOLS: FontConverterTool[] = [
  {
    id: "lvglfont",
    icon: "lvglfont",
    labelKey: "font.toolLvgl",
    component: defineAsyncComponent(
      () => import("./tools/lvglfont/Workbench.vue")
    ),
  },
];

export function getFontConverterTool(
  id: FontConverterId
): FontConverterTool | undefined {
  return FONT_CONVERTER_TOOLS.find((tool) => tool.id === id);
}
