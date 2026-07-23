import type { PetTone } from "./types";

export const PET_BUBBLE_LABEL = "pet-bubble";
export const PET_BUBBLE_EVENT = "pet://bubble-show";
export const PET_BUBBLE_HIDE_EVENT = "pet://bubble-hide";

export interface PetBubblePayload {
  text: string;
  tone: PetTone;
  /** 气泡尖角朝向：指向芯片的一侧 */
  side: "left" | "right";
  durationMs: number;
  /** 写入时间戳，供气泡窗去重/轮询 */
  at?: number;
}
