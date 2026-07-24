<template>
  <div class="chip-slab" aria-hidden="true">
    <div class="chip-face chip-face--back">
      <div class="chip-back-inner">
        <span class="chip-back-mark">{{ visual.mark }}</span>
        <span class="chip-back-grid" />
      </div>
    </div>
    <div class="chip-face chip-face--left">
      <span
        v-for="n in 4"
        :key="'L' + n"
        class="side-led"
        :style="sideLedStyle(9 + n)"
      />
    </div>
    <div class="chip-face chip-face--right">
      <span
        v-for="n in 4"
        :key="'R' + n"
        class="side-led"
        :style="sideLedStyle(2 + n)"
      />
    </div>
    <div class="chip-face chip-face--top" />
    <div class="chip-face chip-face--bottom" />
    <div class="chip-face chip-face--front">
      <svg class="chip-svg" viewBox="0 0 100 100">
        <defs>
          <linearGradient :id="gid.body" x1="0.15" y1="0" x2="0.9" y2="1">
            <stop offset="0%" :stop-color="visual.bodyFrom" />
            <stop offset="45%" :stop-color="visual.bodyMid" />
            <stop offset="100%" :stop-color="visual.bodyTo" />
          </linearGradient>
          <linearGradient :id="gid.die" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" :stop-color="visual.dieFrom" />
            <stop offset="50%" :stop-color="visual.dieMid" />
            <stop offset="100%" :stop-color="visual.dieTo" />
          </linearGradient>
          <linearGradient :id="gid.metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#d5dde8" />
            <stop offset="55%" stop-color="#8b97a8" />
            <stop offset="100%" stop-color="#5c6778" />
          </linearGradient>
          <linearGradient :id="gid.edge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" :stop-color="visual.accent" stop-opacity="0" />
            <stop offset="50%" :stop-color="visual.accent" stop-opacity="0.7" />
            <stop offset="100%" :stop-color="visual.accent" stop-opacity="0" />
          </linearGradient>
          <radialGradient
            v-for="(c, i) in pinColors"
            :id="`${gid.led}-${i}`"
            :key="`${gid.led}-${i}`"
            cx="32%"
            cy="28%"
            r="78%"
          >
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9" />
            <stop offset="38%" :stop-color="c" />
            <stop offset="100%" :stop-color="c" stop-opacity="0.72" />
          </radialGradient>
        </defs>

        <rect
          x="18"
          y="18"
          width="64"
          height="64"
          rx="6"
          :fill="`url(#${gid.body})`"
          :stroke="visual.packageStroke"
          stroke-width="1.2"
        />
        <rect
          x="28"
          y="28"
          width="44"
          height="44"
          rx="3"
          :fill="`url(#${gid.die})`"
          :stroke="visual.dieStroke"
          stroke-width="0.8"
        />
        <g :stroke="visual.accent" stroke-width="0.7" fill="none" opacity="0.35">
          <path d="M32 36 H48 V44 H40" />
          <path d="M68 36 H55 V50 H62" />
          <path d="M34 62 H46 V54" />
          <path d="M66 64 H52 V58 H58" />
        </g>
        <g :fill="visual.accent" opacity="0.45">
          <rect x="31" y="35" width="2.2" height="2.2" rx="0.3" />
          <rect x="46" y="43" width="2.2" height="2.2" rx="0.3" />
          <rect x="60" y="49" width="2.2" height="2.2" rx="0.3" />
          <rect x="44" y="53" width="2.2" height="2.2" rx="0.3" />
          <rect x="56" y="57" width="2.2" height="2.2" rx="0.3" />
        </g>
        <rect
          x="28"
          y="28"
          width="44"
          height="44"
          rx="3"
          fill="none"
          :stroke="`url(#${gid.edge})`"
          stroke-width="0.6"
          opacity="0.55"
        />
        <text class="mark" x="50" y="39" text-anchor="middle">{{ visual.mark }}</text>

        <g class="pins">
          <g v-for="pin in pins" :key="pin.id">
            <rect
              :x="pin.x"
              :y="pin.y"
              :width="pin.w"
              :height="pin.h"
              rx="1.2"
              :fill="`url(#${gid.metal})`"
            />
            <rect
              :x="pin.tipX"
              :y="pin.tipY"
              :width="pin.tipW"
              :height="pin.tipH"
              rx="0.8"
              :fill="`url(#${gid.led}-${pin.index})`"
            />
          </g>
        </g>

        <g class="face">
          <template v-if="mood === 'idle' || mood === 'happy' || mood === 'excited'">
            <rect
              class="sensor"
              x="35"
              :y="blinking ? 47.5 : 44"
              width="10"
              :height="blinking ? 1.5 : 8"
              rx="1.5"
            />
            <rect
              class="sensor"
              x="55"
              :y="blinking ? 47.5 : 44"
              width="10"
              :height="blinking ? 1.5 : 8"
              rx="1.5"
            />
            <template v-if="!blinking">
              <rect
                class="pupil"
                :x="37.2 + gaze.x"
                :y="45.8 + gaze.y"
                width="5.2"
                height="4.4"
                rx="0.8"
              />
              <rect
                class="pupil"
                :x="57.2 + gaze.x"
                :y="45.8 + gaze.y"
                width="5.2"
                height="4.4"
                rx="0.8"
              />
              <rect
                class="spark"
                :x="37.6 + gaze.x * 0.6"
                :y="46.1 + gaze.y * 0.6"
                width="1.6"
                height="1.2"
                rx="0.3"
              />
              <rect
                class="spark"
                :x="57.6 + gaze.x * 0.6"
                :y="46.1 + gaze.y * 0.6"
                width="1.6"
                height="1.2"
                rx="0.3"
              />
            </template>
            <path v-if="mood === 'excited'" class="mouth" d="M40 60 H60" stroke-width="2.6" />
            <path v-else-if="mood === 'happy'" class="mouth" d="M42 59 H58" />
            <path v-else class="mouth soft" d="M44 60 H56" />
          </template>

          <template v-else-if="mood === 'curious'">
            <rect
              class="sensor"
              x="34"
              :y="blinking ? 47 : 43"
              width="11"
              :height="blinking ? 1.5 : 9"
              rx="1.5"
            />
            <rect
              class="sensor"
              x="55"
              :y="blinking ? 47 : 43"
              width="11"
              :height="blinking ? 1.5 : 9"
              rx="1.5"
            />
            <template v-if="!blinking">
              <rect
                class="pupil"
                :x="36.5 + gaze.x"
                :y="45 + gaze.y"
                width="6"
                height="5"
                rx="0.8"
              />
              <rect
                class="pupil"
                :x="57.5 + gaze.x"
                :y="45 + gaze.y"
                width="6"
                height="5"
                rx="0.8"
              />
            </template>
            <rect class="mouth-box" x="47" y="59" width="6" height="5" rx="1" />
          </template>

          <template v-else-if="mood === 'grumpy'">
            <path class="brow" d="M34 43 L46 46" />
            <path class="brow" d="M66 43 L54 46" />
            <rect
              class="sensor"
              x="35"
              :y="blinking ? 48.5 : 46"
              width="10"
              :height="blinking ? 1.2 : 6"
              rx="1.2"
            />
            <rect
              class="sensor"
              x="55"
              :y="blinking ? 48.5 : 46"
              width="10"
              :height="blinking ? 1.2 : 6"
              rx="1.2"
            />
            <template v-if="!blinking">
              <rect
                class="pupil"
                :x="37.5 + gaze.x * 0.8"
                :y="47.2 + gaze.y * 0.8"
                width="4.5"
                height="3.5"
                rx="0.6"
              />
              <rect
                class="pupil"
                :x="57.5 + gaze.x * 0.8"
                :y="47.2 + gaze.y * 0.8"
                width="4.5"
                height="3.5"
                rx="0.6"
              />
            </template>
            <path class="mouth" d="M42 62 H58" />
          </template>

          <template v-else>
            <path class="sleep-eye" d="M35 50 H45" />
            <path class="sleep-eye" d="M55 50 H65" />
            <text class="zzz" x="72" y="34">z</text>
          </template>
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PetMood } from "../types";
import type { PetSkinVisual } from "../skins/types";

const props = defineProps<{
  visual: PetSkinVisual;
  mood: PetMood;
  blinking: boolean;
  gaze: { x: number; y: number };
  pinColors: string[];
}>();

const uid = Math.random().toString(36).slice(2, 8);
const gid = computed(() => ({
  body: `chip-body-${uid}`,
  die: `chip-die-${uid}`,
  metal: `chip-metal-${uid}`,
  edge: `chip-edge-${uid}`,
  led: `chip-led-${uid}`,
}));

function sideLedStyle(index: number) {
  const c = props.pinColors[index] ?? "#1a6b78";
  return {
    background: `linear-gradient(155deg, color-mix(in srgb, ${c} 55%, #fff) 0%, ${c} 48%, color-mix(in srgb, ${c} 65%, #000) 100%)`,
    boxShadow: `0 0 7px ${c}`,
  };
}

interface PinDef {
  id: string;
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  tipX: number;
  tipY: number;
  tipW: number;
  tipH: number;
}

const pins: PinDef[] = [
  { id: "t0", index: 0, x: 32, y: 7, w: 5, h: 11, tipX: 32.5, tipY: 7, tipW: 4, tipH: 3 },
  { id: "t1", index: 1, x: 47.5, y: 7, w: 5, h: 11, tipX: 48, tipY: 7, tipW: 4, tipH: 3 },
  { id: "t2", index: 2, x: 63, y: 7, w: 5, h: 11, tipX: 63.5, tipY: 7, tipW: 4, tipH: 3 },
  { id: "r0", index: 3, x: 82, y: 28, w: 11, h: 5, tipX: 90, tipY: 28.5, tipW: 3, tipH: 4 },
  { id: "r1", index: 4, x: 82, y: 40, w: 11, h: 5, tipX: 90, tipY: 40.5, tipW: 3, tipH: 4 },
  { id: "r2", index: 5, x: 82, y: 52, w: 11, h: 5, tipX: 90, tipY: 52.5, tipW: 3, tipH: 4 },
  { id: "r3", index: 6, x: 82, y: 64, w: 11, h: 5, tipX: 90, tipY: 64.5, tipW: 3, tipH: 4 },
  { id: "b2", index: 7, x: 63, y: 82, w: 5, h: 11, tipX: 63.5, tipY: 90, tipW: 4, tipH: 3 },
  { id: "b1", index: 8, x: 47.5, y: 82, w: 5, h: 11, tipX: 48, tipY: 90, tipW: 4, tipH: 3 },
  { id: "b0", index: 9, x: 32, y: 82, w: 5, h: 11, tipX: 32.5, tipY: 90, tipW: 4, tipH: 3 },
  { id: "l3", index: 10, x: 7, y: 64, w: 11, h: 5, tipX: 7, tipY: 64.5, tipW: 3, tipH: 4 },
  { id: "l2", index: 11, x: 7, y: 52, w: 11, h: 5, tipX: 7, tipY: 52.5, tipW: 3, tipH: 4 },
  { id: "l1", index: 12, x: 7, y: 40, w: 11, h: 5, tipX: 7, tipY: 40.5, tipW: 3, tipH: 4 },
  { id: "l0", index: 13, x: 7, y: 28, w: 11, h: 5, tipX: 7, tipY: 28.5, tipW: 3, tipH: 4 },
];
</script>

<style scoped>
.chip-slab {
  --chip-depth: 46px;
  --chip-half: 23px;
  --body: 70px;
  --body-half: 35px;
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--body);
  height: var(--body);
  margin: 0;
  transform: translate(-50%, -50%) rotateY(-32deg) rotateX(22deg);
  transform-style: preserve-3d;
  z-index: 1;
}

.chip-face {
  position: absolute;
  box-sizing: border-box;
  transform-style: preserve-3d;
}

.chip-face--front,
.chip-face--back {
  width: var(--body);
  height: var(--body);
  left: 0;
  top: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 8px;
}

.chip-face--front {
  transform: translateZ(var(--chip-half));
  background: transparent;
  overflow: visible;
}

.chip-face--back {
  transform: rotateY(180deg) translateZ(var(--chip-half));
  background: linear-gradient(145deg, #243044 0%, #0c121c 55%, #05070c 100%);
  border: 1px solid var(--pet-package-stroke, #3d4f66);
  overflow: hidden;
}

.chip-back-inner {
  position: absolute;
  inset: 12%;
  border-radius: 6px;
  background: linear-gradient(
    160deg,
    var(--pet-die-from, #15303c),
    var(--pet-die-to, #071018)
  );
  border: 1px solid color-mix(in srgb, var(--pet-accent, #00e5ff) 28%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
}

.chip-back-mark {
  font-family: Consolas, "Courier New", monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: color-mix(in srgb, var(--pet-accent, #00e5ff) 45%, transparent);
}

.chip-back-grid {
  position: absolute;
  inset: 6px;
  opacity: 0.28;
  background-image:
    linear-gradient(var(--pet-back-grid, rgba(0, 229, 255, 0.4)) 1px, transparent 1px),
    linear-gradient(90deg, var(--pet-back-grid, rgba(0, 229, 255, 0.4)) 1px, transparent 1px);
  background-size: 7px 7px;
  pointer-events: none;
}

.chip-face--left,
.chip-face--right {
  width: var(--chip-depth);
  height: var(--body);
  top: 0;
  left: 50%;
  margin-left: calc(var(--chip-half) * -1);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-evenly;
  padding: 10px 0;
  border: 1px solid color-mix(in srgb, var(--pet-accent, #00e5ff) 35%, transparent);
}

.chip-face--right {
  transform: rotateY(90deg) translateZ(var(--body-half));
  background: linear-gradient(
    180deg,
    var(--pet-side-hi, #5a7a8c) 0%,
    var(--pet-side-mid, #2a4050) 35%,
    #152028 70%,
    var(--pet-side-lo, #0a1218) 100%
  );
}

.chip-face--left {
  transform: rotateY(-90deg) translateZ(var(--body-half));
  background: linear-gradient(
    180deg,
    var(--pet-side-mid, #3a5060) 0%,
    #1a2834 40%,
    var(--pet-side-lo, #0c141c) 100%
  );
}

.chip-face--top,
.chip-face--bottom {
  width: var(--body);
  height: var(--chip-depth);
  left: 0;
  top: 50%;
  margin-top: calc(var(--chip-half) * -1);
  border: 1px solid rgba(120, 160, 190, 0.35);
}

.chip-face--top {
  transform: rotateX(90deg) translateZ(var(--body-half));
  background: linear-gradient(
    90deg,
    var(--pet-side-hi, #6a8498) 0%,
    #9eb4c4 45%,
    var(--pet-side-mid, #3a5060) 100%
  );
}

.chip-face--bottom {
  transform: rotateX(-90deg) translateZ(var(--body-half));
  background: linear-gradient(
    90deg,
    var(--pet-side-lo, #0a1016) 0%,
    #1a242e 50%,
    #05080c 100%
  );
}

.side-led {
  width: 7px;
  height: 7px;
  border-radius: 1.5px;
  box-shadow: 0 0 6px currentColor;
  flex-shrink: 0;
}

.chip-svg {
  position: absolute;
  width: 156.25%;
  height: 156.25%;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: block;
  overflow: visible;
}

.mark {
  fill: color-mix(in srgb, var(--pet-accent, #00e5ff) 28%, transparent);
  font-size: 7px;
  font-family: Consolas, "Courier New", monospace;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.sensor {
  fill: #031820;
  stroke: var(--pet-accent, #00e5ff);
  stroke-width: 0.7;
}

.pupil {
  fill: var(--pet-accent, #00e5ff);
}

.spark {
  fill: #e8ffff;
}

.mouth,
.brow,
.sleep-eye {
  fill: none;
  stroke: var(--pet-accent-soft, #7eefff);
  stroke-width: 2;
  stroke-linecap: square;
}

.mouth.soft {
  stroke-width: 1.6;
  opacity: 0.75;
}

.mouth-box {
  fill: none;
  stroke: var(--pet-accent-soft, #7eefff);
  stroke-width: 1.6;
}

.brow {
  stroke-width: 1.8;
}

.zzz {
  fill: color-mix(in srgb, var(--pet-accent-soft, #7eefff) 70%, transparent);
  font-size: 10px;
  font-family: Consolas, monospace;
  font-weight: 700;
}
</style>
