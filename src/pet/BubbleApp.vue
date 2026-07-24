<template>
  <div
    v-if="visible"
    class="bubble"
    :data-tone="tone"
    :data-side="side"
  >
    <div class="bubble-inner">
      <p class="text">
        <span>{{ displayText }}</span>
        <span v-if="typing" class="caret">▌</span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  PET_BUBBLE_EVENT,
  PET_BUBBLE_HIDE_EVENT,
  type PetBubblePayload,
} from "./bubbleTypes";
import type { PetTone } from "./types";

const visible = ref(false);
const displayText = ref("");
const tone = ref<PetTone>("cute");
const side = ref<"left" | "right">("right");
const typing = ref(false);

let hideTimer: number | null = null;
let typeTimer: number | null = null;
let pollTimer: number | null = null;
let lastAppliedAt = 0;
let unlistenShow: UnlistenFn | null = null;
let unlistenHide: UnlistenFn | null = null;

function clearHideTimer() {
  if (hideTimer != null) window.clearTimeout(hideTimer);
  hideTimer = null;
}

function clearTypeTimer() {
  if (typeTimer != null) window.clearTimeout(typeTimer);
  typeTimer = null;
}

function charDelay(ch: string): number {
  if (/[，。！？、；：…~～]/.test(ch)) return 140;
  if (/[,.!?;:]/.test(ch)) return 110;
  if (/\s/.test(ch)) return 24;
  if (/[^\u0000-\u00ff]/.test(ch)) return 38;
  return 22;
}

function typeOut(full: string, holdMs: number) {
  clearTypeTimer();
  displayText.value = "";
  typing.value = true;
  let i = 0;

  const step = () => {
    if (i >= full.length) {
      typing.value = false;
      clearHideTimer();
      hideTimer = window.setTimeout(async () => {
        visible.value = false;
        try {
          await getCurrentWindow().hide();
        } catch {
          // ignore
        }
      }, holdMs);
      return;
    }
    const ch = full[i++];
    displayText.value += ch;
    typeTimer = window.setTimeout(step, charDelay(ch));
  };
  step();
}

async function applyPayload(payload: PetBubblePayload & { at?: number }) {
  const at = payload.at ?? Date.now();
  // 同一条消息（含补发）只开播一次；补发必须带相同 at
  if (at <= lastAppliedAt) return;
  lastAppliedAt = at;

  tone.value = payload.tone;
  side.value = payload.side;
  visible.value = true;
  clearHideTimer();

  const hold = Math.max(900, payload.durationMs - payload.text.length * 30);
  typeOut(payload.text, hold);
}

function tryReadStorage() {
  try {
    const raw = localStorage.getItem("wheat-esp-pet-bubble-payload");
    if (!raw) return;
    const payload = JSON.parse(raw) as PetBubblePayload & { at?: number };
    if (!payload?.text) return;
    if (payload.at && Date.now() - payload.at > 1500) return;
    void applyPayload(payload);
  } catch {
    // ignore
  }
}

onMounted(async () => {
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
  document.documentElement.style.setProperty("background", "transparent", "important");
  document.body.style.setProperty("background", "transparent", "important");

  try {
    await getCurrentWindow().setShadow(false);
  } catch {
    // ignore
  }

  unlistenShow = await listen<PetBubblePayload>(PET_BUBBLE_EVENT, (e) => {
    void applyPayload(e.payload);
  });
  unlistenHide = await listen(PET_BUBBLE_HIDE_EVENT, async () => {
    visible.value = false;
    typing.value = false;
    clearHideTimer();
    clearTypeTimer();
    try {
      await getCurrentWindow().hide();
    } catch {
      // ignore
    }
  });

  tryReadStorage();
  pollTimer = window.setInterval(tryReadStorage, 150);
});

onUnmounted(() => {
  clearHideTimer();
  clearTypeTimer();
  if (pollTimer != null) window.clearInterval(pollTimer);
  unlistenShow?.();
  unlistenHide?.();
});
</script>

<style>
/* 非 scoped：彻底清掉 webview 默认底色，避免透出灰块 */
html,
body,
#bubble-app {
  background: transparent !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}
</style>

<style scoped>
.bubble {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 6px; /* 给尖角留位，避免裁切，但不投影 */
  position: relative;
  background: transparent;
  animation: pop 0.18s cubic-bezier(0.22, 1.15, 0.36, 1);
}

.bubble-inner {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 9px 11px;
  border-radius: 10px;
  background: rgba(8, 14, 22, 0.94);
  border: 1px solid rgba(0, 229, 255, 0.4);
  /* Windows 透明窗上 box-shadow 常变成灰矩形，禁止外阴影 */
  box-shadow: none;
  overflow: hidden;
  display: flex;
  align-items: center;
}

.bubble[data-tone="snarky"] .bubble-inner {
  border-color: rgba(255, 140, 80, 0.45);
}

.bubble::after {
  content: "";
  position: absolute;
  top: 50%;
  width: 8px;
  height: 8px;
  background: rgba(8, 14, 22, 0.94);
  border-left: 1px solid rgba(0, 229, 255, 0.4);
  border-bottom: 1px solid rgba(0, 229, 255, 0.4);
  transform: translateY(-50%) rotate(45deg);
  box-shadow: none;
}

.bubble[data-tone="snarky"]::after {
  border-left-color: rgba(255, 140, 80, 0.45);
  border-bottom-color: rgba(255, 140, 80, 0.45);
}

.bubble[data-side="right"]::after {
  left: 2px;
}

.bubble[data-side="left"]::after {
  right: 2px;
  transform: translateY(-50%) rotate(-135deg);
}

.text {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: rgba(220, 245, 255, 0.95);
  word-break: break-word;
  white-space: pre-wrap;
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  letter-spacing: 0.02em;
}

.caret {
  display: inline-block;
  margin-left: 1px;
  color: rgba(0, 229, 255, 0.85);
  animation: blink 0.8s step-end infinite;
  font-size: 11px;
}

@keyframes pop {
  from {
    opacity: 0;
    transform: translateX(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}
</style>
