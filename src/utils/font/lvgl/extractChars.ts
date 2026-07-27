import { invoke } from "@tauri-apps/api/core";

export interface ExtractLvglFontCharsResult {
  characters: string;
  count: number;
  sourceName: string;
}

/**
 * 从已有 LVGL 字体 `.c` 提取全部字符（纯 Rust 解析）。
 * 优先传本地路径，避免大文件 IPC 拷贝。
 */
export async function extractLvglFontChars(input: {
  path?: string | null;
  content?: string | null;
}): Promise<ExtractLvglFontCharsResult> {
  const path = input.path?.trim() || null;
  const content = path ? null : input.content ?? null;
  if (!path && (content == null || !String(content).trim())) {
    throw new Error("未提供 LVGL 字体 C 文件路径或内容");
  }
  return invoke<ExtractLvglFontCharsResult>("extract_lvgl_font_chars", {
    path,
    content,
  });
}
