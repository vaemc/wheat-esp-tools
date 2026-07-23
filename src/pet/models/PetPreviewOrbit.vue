<template>
  <div
    class="orbit-stage"
    :data-model="model"
    :style="stageStyle"
    @wheel.prevent="onWheel"
  >
    <div class="stage-lights" aria-hidden="true">
      <i class="light-spot light-spot--key" />
      <i class="light-spot light-spot--rim" />
      <i class="light-spot light-spot--fill" />
      <i class="light-haze" />
      <i class="light-vignette" />
    </div>

    <template v-if="model === 'chip'">
      <div
        class="orbit-pad"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @dblclick="resetOrbit"
      >
        <div class="orbit-floor" />
        <div class="orbit-scene">
          <div class="orbit-rig" :style="rigStyle">
            <PetChipModel
              :visual="visual"
              :mood="mood"
              :blinking="false"
              :gaze="{ x: 0.4, y: 0.1 }"
              :pin-colors="pinColors"
            />
          </div>
        </div>
        <p v-if="hint" class="orbit-hint">{{ hint }}</p>
      </div>
    </template>

    <div v-else-if="model === 'toon'" class="fig-pad toon-pad">
      <div class="fig-floor" />
      <div class="fig-stage">
        <div class="fig-zoom" :style="figZoomStyle">
          <PetToonModel
            :visual="visual"
            :mood="mood"
            :gaze="{ x: 0.3, y: 0.1 }"
            :motion="previewMotion"
            :decor="toonDecor"
            :show-shadow="false"
          />
        </div>
      </div>
      <p v-if="hint" class="orbit-hint">{{ hint }}</p>
    </div>

    <div
      v-else-if="model === 'vrm'"
      class="orbit-pad vrm-orbit"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @dblclick="resetOrbit"
    >
      <div class="orbit-floor" />
      <div class="vrm-orbit-stage">
        <div class="vrm-orbit-zoom" :style="figZoomStyle">
          <PetVrmModel
            :mood="mood"
            :gaze="previewGaze"
            :motion="previewMotion"
            :orbit-yaw="yaw"
            :orbit-pitch="pitch"
          />
        </div>
      </div>
      <p v-if="hint" class="orbit-hint">{{ hint }}</p>
    </div>

    <div v-else class="fig-pad">
      <div class="fig-floor" />
      <div class="fig-stage">
        <div class="fig-zoom" :style="figZoomStyle">
          <PetFigSciModel
            :visual="visual"
            :mood="mood"
            :gaze="{ x: 0, y: 0 }"
            :motion="previewMotion"
            :fig-art-id="figArtId"
          />
        </div>
      </div>
      <p v-if="hint" class="orbit-hint">{{ hint }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { PetChipModel, PetFigSciModel, PetToonModel, PetVrmModel } from "@/pet/models";
import type { PetIdleMotion } from "@/pet/motions";
import type { PetFigArtId, PetModelKind, PetSkinVisual } from "@/pet/skins";
import {
  clampPreviewBoost,
  previewBoostScale,
} from "@/pet/sizes";
import type { PetMood } from "@/pet/types";
import type { PetToonDecorId } from "@/pet/skins/themes";

const props = withDefaults(
  defineProps<{
    model: PetModelKind;
    visual: PetSkinVisual;
    mood?: PetMood;
    hint?: string;
    figArtId?: PetFigArtId | null;
    toonDecor?: PetToonDecorId | null;
  }>(),
  {
    mood: "idle",
    hint: "",
    figArtId: null,
    toonDecor: null,
  }
);

const yaw = ref(18);
const pitch = ref(8);
const dragging = ref(false);
const previewBoost = ref(0);
const previewMotion = ref<PetIdleMotion>("idle-float");
const previewGaze = ref({ x: 0.2, y: 0.05 });
const pinColors = ref<string[]>(Array.from({ length: 14 }, () => "#1a6b78"));

let lastX = 0;
let lastY = 0;
let raf = 0;
let idleCycleTimer = 0;

const stageStyle = computed(
  () =>
    ({
      "--orbit-accent": props.visual.accent,
      "--orbit-accent-soft": props.visual.accentSoft,
      "--pet-accent": props.visual.accent,
      "--pet-accent-soft": props.visual.accentSoft,
      "--pet-side-hi": props.visual.sideHi,
      "--pet-side-mid": props.visual.sideMid,
      "--pet-side-lo": props.visual.sideLo,
      "--pet-back-grid": props.visual.backGrid,
      "--pet-package-stroke": props.visual.packageStroke,
      "--pet-die-from": props.visual.dieFrom,
      "--pet-die-to": props.visual.dieTo,
    }) as Record<string, string>
);

const combinedScale = computed(() => previewBoostScale(previewBoost.value));

const rigStyle = computed(() => {
  return {
    transform: `rotateX(${pitch.value}deg) rotateY(${yaw.value}deg) scale(${combinedScale.value})`,
  };
});

const figZoomStyle = computed(() => ({
  transform: `scale(${combinedScale.value})`,
}));

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hsl(h: number, s: number, l: number) {
  return `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`;
}

function tickLeds(now: number) {
  const phase = now / 150;
  const breath = 0.5 + 0.5 * Math.sin(now / 620);
  const baseHue = props.visual.ledHue;
  const next = new Array<string>(14);
  for (let i = 0; i < 14; i++) {
    let dist = Math.abs(i - (phase % 14));
    dist = Math.min(dist, 14 - dist);
    const chase = Math.exp(-dist * dist * 0.5);
    const t = clamp(chase * 0.95 + breath * 0.22, 0, 1);
    const hue = baseHue + i * 5 + phase * 7 + t * 28;
    next[i] = hsl(hue, 70 + t * 25, 28 + t * 42);
  }
  pinColors.value = next;
}

function resetOrbit() {
  yaw.value = props.model === "vrm" ? 18 : -38;
  pitch.value = props.model === "vrm" ? 8 : 22;
  previewBoost.value = 0;
}

function onWheel(e: WheelEvent) {
  const delta = e.deltaY > 0 ? -5 : 5;
  previewBoost.value = clampPreviewBoost(previewBoost.value + delta);
}

function onDown(e: PointerEvent) {
  if (e.button !== 0) return;
  dragging.value = true;
  lastX = e.clientX;
  lastY = e.clientY;
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    // ignore
  }
}

function onMove(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement | null;
  if (el && props.model === "vrm") {
    const rect = el.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
    previewGaze.value = {
      x: clamp(nx * 0.85, -1, 1),
      y: clamp(ny * 0.75, -0.85, 0.85),
    };
  }
  if (!dragging.value) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  yaw.value += dx * 0.45;
  pitch.value = clamp(pitch.value - dy * 0.35, -28, 42);
}

function onUp() {
  dragging.value = false;
}

function tick(now: number) {
  if (props.model === "chip") {
    tickLeds(now);
    if (!dragging.value) yaw.value += 0.22;
  } else if (props.model === "vrm") {
    if (!dragging.value) yaw.value += 0.28;
  }
  raf = window.requestAnimationFrame(tick);
}

function scheduleIdleClip() {
  window.clearTimeout(idleCycleTimer);
  idleCycleTimer = window.setTimeout(() => {
    if (props.model === "chip") {
      scheduleIdleClip();
      return;
    }
    const clips: PetIdleMotion[] =
      props.model === "toon"
        ? [
            "toon-grass",
            "toon-thunder",
            "toon-sway",
            "toon-walk",
            "toon-tilt",
            "happy-bounce",
            "idle-float",
            "peekaboo",
          ]
        : props.model === "vrm"
          ? [
              "happy-bounce",
              "sway-step",
              "bow-nod",
              "vrm-walk",
              "idle-float",
            ]
        : [
            "happy-bounce",
            "sway-step",
            "side-hop",
            "tip-toe",
            "bow-nod",
            "stretch-up",
            "peekaboo",
            "victory-burst",
            "idle-float",
          ];
    const next = clips[Math.floor(Math.random() * clips.length)]!;
    previewMotion.value = next;
    window.setTimeout(() => {
      previewMotion.value = "idle-float";
      scheduleIdleClip();
    }, next === "idle-float" ? 800 : 1800);
  }, 4500 + Math.random() * 4000);
}

watch(
  () => props.model,
  () => {
    resetOrbit();
    previewMotion.value = "idle-float";
  },
  { immediate: true }
);

onMounted(() => {
  raf = window.requestAnimationFrame(tick);
  scheduleIdleClip();
});

onUnmounted(() => {
  if (raf) window.cancelAnimationFrame(raf);
  window.clearTimeout(idleCycleTimer);
});
</script>

<style scoped>
.orbit-stage {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 12px;
  /* 不可 hidden/filter 祖先，否则芯片 CSS 3D 会被压成纸片 */
  overflow: visible;
}

.orbit-stage[data-model="fig-sci"],
.orbit-stage[data-model="toon"],
.orbit-stage[data-model="vrm"] {
  overflow: visible;
  min-height: 0;
}

.orbit-stage[data-model="vrm"] {
  perspective: none;
  transform-style: flat;
}

.stage-lights {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  border-radius: 12px;
  overflow: hidden;
}

.light-spot {
  position: absolute;
  border-radius: 50%;
  filter: blur(28px);
  opacity: 0.55;
}

.light-spot--key {
  width: 72%;
  height: 48%;
  left: 14%;
  top: -8%;
  background: radial-gradient(
    ellipse at 50% 40%,
    color-mix(in srgb, var(--orbit-accent-soft, #7eefff) 55%, #fff) 0%,
    color-mix(in srgb, var(--orbit-accent, #00e5ff) 28%, transparent) 42%,
    transparent 70%
  );
  animation: light-breathe 5.5s ease-in-out infinite;
}

.light-spot--rim {
  width: 40%;
  height: 55%;
  right: -6%;
  top: 18%;
  background: radial-gradient(
    ellipse at center,
    color-mix(in srgb, var(--orbit-accent, #00e5ff) 40%, transparent),
    transparent 68%
  );
  opacity: 0.4;
  filter: blur(36px);
}

.light-spot--fill {
  width: 55%;
  height: 40%;
  left: -8%;
  bottom: 8%;
  background: radial-gradient(
    ellipse at center,
    rgba(120, 160, 255, 0.22),
    transparent 70%
  );
  opacity: 0.5;
  filter: blur(40px);
}

.light-haze {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      165deg,
      color-mix(in srgb, var(--orbit-accent, #00e5ff) 10%, transparent) 0%,
      transparent 38%,
      rgba(0, 0, 0, 0.35) 100%
    ),
    radial-gradient(
      ellipse at 50% 100%,
      rgba(0, 0, 0, 0.55),
      transparent 58%
    );
}

.light-vignette {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 80px rgba(0, 0, 0, 0.55);
  border-radius: 12px;
}

@keyframes light-breathe {
  0%,
  100% {
    opacity: 0.48;
    transform: scale(1);
  }
  50% {
    opacity: 0.72;
    transform: scale(1.04);
  }
}

.orbit-pad,
.fig-pad {
  position: absolute;
  inset: 0;
  user-select: none;
  overflow: hidden;
  border-radius: 12px;
  background:
    radial-gradient(
      ellipse at 50% 28%,
      color-mix(in srgb, var(--orbit-accent, #00e5ff) 14%, transparent),
      transparent 46%
    ),
    radial-gradient(
      ellipse at 50% 78%,
      color-mix(in srgb, var(--orbit-accent, #00e5ff) 18%, transparent),
      transparent 55%
    ),
    linear-gradient(180deg, rgba(18, 24, 36, 0.55), rgba(4, 6, 12, 0.82));
  border: 1px solid rgba(255, 255, 255, 0.07);
  z-index: 1;
}

.orbit-pad {
  cursor: grab;
  touch-action: none;
  perspective: 920px;
  perspective-origin: 50% 42%;
  overflow: hidden;
  transform-style: preserve-3d;
  container-type: size;
  border-radius: 12px;
}

.orbit-pad:active {
  cursor: grabbing;
}

.orbit-floor,
.fig-floor {
  position: absolute;
  left: 22%;
  right: 22%;
  bottom: 12%;
  height: 28px;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0.5) 0%,
    rgba(0, 0, 0, 0.22) 40%,
    transparent 72%
  );
  pointer-events: none;
  z-index: 0;
  filter: blur(0.6px);
}

.fig-floor {
  bottom: 12%;
  left: 28%;
  right: 28%;
  height: 22px;
}

.orbit-scene {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  transform-style: preserve-3d;
  perspective: inherit;
  z-index: 1;
  pointer-events: none;
}

.orbit-rig {
  width: 120px;
  height: 120px;
  position: relative;
  transform-style: preserve-3d;
  transform-origin: 50% 55%;
  will-change: transform;
  scale: min(1, 80cqmin / 150);
}

.orbit-rig :deep(.chip-slab) {
  --body: 92px;
  --body-half: 46px;
  --chip-depth: 64px;
  --chip-half: 32px;
  position: absolute;
  left: 50%;
  top: 50%;
  margin: -46px 0 0 -46px;
  transform: rotateY(0deg) rotateX(0deg);
  transform-style: preserve-3d;
}

.fig-stage {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  z-index: 1;
}

.fig-zoom {
  transform-origin: 50% 85%;
}

.fig-stage :deep(.fig-root) {
  position: relative;
  left: auto;
  top: auto;
  margin: 0;
  width: 270px;
  height: 450px;
  transform: none;
}

.fig-stage :deep(.pix) {
  position: relative;
  left: auto;
  top: auto;
  margin: 0;
  width: 168px;
  height: 168px;
}

.orbit-pad.vrm-orbit {
  perspective: none;
  transform-style: flat;
}

.vrm-orbit-stage {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  z-index: 1;
  pointer-events: none;
}

.vrm-orbit-zoom {
  width: min(280px, 70%);
  height: min(420px, 90%);
  transform-origin: 50% 60%;
}

.vrm-orbit-zoom :deep(.vrm-wrap) {
  width: 100%;
  height: 100%;
}

.vrm-pad .fig-zoom {
  width: min(240px, 58%);
  height: min(400px, 88%);
}

.vrm-pad .fig-stage :deep(.vrm-wrap) {
  width: 100%;
  height: 100%;
}

.orbit-hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 8px;
  margin: 0;
  text-align: center;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.38);
  pointer-events: none;
  z-index: 2;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.6);
  padding: 0 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
