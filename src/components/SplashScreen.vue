<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";
import { useAppSplash } from "@/composables/useAppSplash";

const HOLD_MS = 1600;
const LEAVE_MS = 450;

const { visible, hide, markBootDone } = useAppSplash();

let hideTimer: ReturnType<typeof setTimeout> | undefined;
let removeTimer: ReturnType<typeof setTimeout> | undefined;
let finished = false;

function finishBoot() {
  if (finished) return;
  finished = true;
  markBootDone();
}

/** 首次启动：处理 index.html 内的原生开屏节点 */
onMounted(() => {
  const el = document.getElementById("app-splash");
  if (!el) {
    finishBoot();
    return;
  }

  hideTimer = setTimeout(() => {
    el.classList.add("app-splash-leave");

    const onEnd = (event: TransitionEvent) => {
      if (event.target !== el || event.propertyName !== "opacity") return;
      el.removeEventListener("transitionend", onEnd);
      if (removeTimer !== undefined) clearTimeout(removeTimer);
      el.remove();
      finishBoot();
    };

    el.addEventListener("transitionend", onEnd);
    removeTimer = setTimeout(() => {
      el.removeEventListener("transitionend", onEnd);
      if (el.isConnected) el.remove();
      finishBoot();
    }, LEAVE_MS + 80);
  }, HOLD_MS);
});

onUnmounted(() => {
  if (hideTimer !== undefined) clearTimeout(hideTimer);
  if (removeTimer !== undefined) clearTimeout(removeTimer);
});

watch(visible, (open) => {
  document.body.style.overflow = open ? "hidden" : "";
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="app-splash-overlay"
      aria-hidden="true"
      @click="hide"
    >
      <div class="app-splash-content">
        <img class="app-splash-logo" src="/logo.png" alt="" />
        <h1 class="app-splash-title">Wheat ESP Tools</h1>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.app-splash-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0a0a;
  animation: splash-overlay-in 0.35s ease both;
  cursor: pointer;
}

.app-splash-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  pointer-events: none;
}

.app-splash-logo {
  width: 140px;
  height: 140px;
  border-radius: 28px;
  object-fit: cover;
  animation: splash-logo-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.app-splash-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.92);
  animation: splash-title-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both;
}

@keyframes splash-overlay-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes splash-logo-in {
  from {
    opacity: 0;
    transform: scale(0.82) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes splash-title-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
