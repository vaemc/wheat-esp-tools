/**
 * 音频处理 → 转换工具注册表。
 * 新增工具时：在 tools/ 下建同级目录，并在此登记即可。
 */
import type { Component } from "vue";
import { defineAsyncComponent } from "vue";

export type AudioConverterId = "wav2ogg";

export interface AudioConverterTool {
  id: AudioConverterId;
  /** MenuIcon 名 */
  icon: string;
  labelKey: string;
  component: Component;
}

export const AUDIO_CONVERTER_TOOLS: AudioConverterTool[] = [
  {
    id: "wav2ogg",
    icon: "wav2ogg",
    labelKey: "audio.toolWav2Ogg",
    component: defineAsyncComponent(
      () => import("./tools/wav2ogg/Workbench.vue")
    ),
  },
];

export function getAudioConverterTool(
  id: AudioConverterId
): AudioConverterTool | undefined {
  return AUDIO_CONVERTER_TOOLS.find((tool) => tool.id === id);
}
