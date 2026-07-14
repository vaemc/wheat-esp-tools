<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

const emit = defineEmits<{ done: [] }>();

const HOLD_MS = 1600;
const LEAVE_MS = 450;

let hideTimer: ReturnType<typeof setTimeout> | undefined;
let removeTimer: ReturnType<typeof setTimeout> | undefined;
let finished = false;

function finish() {
  if (finished) return;
  finished = true;
  emit("done");
}

onMounted(() => {
  const el = document.getElementById("app-splash");
  if (!el) {
    finish();
    return;
  }

  hideTimer = setTimeout(() => {
    el.classList.add("app-splash-leave");

    const onEnd = (event: TransitionEvent) => {
      if (event.target !== el || event.propertyName !== "opacity") return;
      el.removeEventListener("transitionend", onEnd);
      if (removeTimer !== undefined) clearTimeout(removeTimer);
      el.remove();
      finish();
    };

    el.addEventListener("transitionend", onEnd);
    removeTimer = setTimeout(() => {
      el.removeEventListener("transitionend", onEnd);
      if (el.isConnected) el.remove();
      finish();
    }, LEAVE_MS + 80);
  }, HOLD_MS);
});

onUnmounted(() => {
  if (hideTimer !== undefined) clearTimeout(hideTimer);
  if (removeTimer !== undefined) clearTimeout(removeTimer);
});
</script>

<template></template>
