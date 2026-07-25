import { invoke } from "@tauri-apps/api/core";
import { sanitizeIdentFragment } from "./range";

/** 调用 Rust：汉字→无声调拼音，其它字母数字保留，得到 C 标识片段 */
export async function toIdentPinyin(text: string): Promise<string> {
  const raw = text.trim();
  if (!raw) {
    return "font";
  }
  try {
    const slug = await invoke<string>("to_ident_pinyin", { text: raw });
    return sanitizeIdentFragment(slug || "font");
  } catch (error) {
    console.error("[toIdentPinyin]", error);
    return sanitizeIdentFragment(raw.replace(/[^a-zA-Z0-9]+/g, "_") || "font");
  }
}
