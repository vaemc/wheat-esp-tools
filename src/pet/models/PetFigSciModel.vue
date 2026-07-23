<template>
  <div
    class="fig-root"
    :data-mood="mood"
    :data-motion="motion"
    :data-fig-art="figArtKey"
    :style="rootVars"
    aria-hidden="true"
  >
    <i class="fig-shadow" />
    <div class="fig-bob">
      <img class="fig-art" :src="artSrc" alt="" draggable="false" />
      <span v-if="mood === 'sleep'" class="fig-zzz">z</span>
      <i
        v-else-if="mood === 'happy' || mood === 'excited'"
        class="fig-spark"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PetIdleMotion } from "../motions";
import type { PetMood } from "../types";
import type { PetFigArtId, PetSkinVisual } from "../skins";

import artCool from "../assets/fig/cool.png";
import artSunny from "../assets/fig/sunny.png";
import artShy from "../assets/fig/shy.png";
import artFiery from "../assets/fig/fiery.png";
import artValentine from "../assets/fig/valentine.png";
import artSpring from "../assets/fig/spring.png";
import artMidautumn from "../assets/fig/midautumn.png";
import artLabor from "../assets/fig/labor.png";

const ART_BY_FIG_THEME: Record<PetFigArtId, string> = {
  sunny: artSunny,
  shy: artShy,
  cool: artCool,
  fiery: artFiery,
  valentine: artValentine,
  spring: artSpring,
  midautumn: artMidautumn,
  labor: artLabor,
};

const props = withDefaults(
  defineProps<{
    visual: PetSkinVisual;
    mood: PetMood;
    gaze: { x: number; y: number };
    motion?: PetIdleMotion;
    figArtId?: PetFigArtId | null;
  }>(),
  {
    motion: "idle-float",
    figArtId: "sunny",
  }
);

const figArtKey = computed(() => props.figArtId || "sunny");
const artSrc = computed(
  () => ART_BY_FIG_THEME[figArtKey.value] ?? artSunny
);

const rootVars = computed(
  () =>
    ({
      "--fig-accent": props.visual.accent,
      "--fig-accent-soft": props.visual.accentSoft,
      "--fig-gaze-x": `${props.gaze.x * 0.35}px`,
      "--fig-gaze-y": `${props.gaze.y * 0.25}px`,
    }) as Record<string, string>
);
</script>

<style scoped>
.fig-root {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: end center;
  overflow: visible;
  pointer-events: none;
  user-select: none;
}

.fig-shadow {
  position: absolute;
  left: 24%;
  right: 24%;
  bottom: 0;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at center,
    color-mix(in srgb, var(--fig-accent, #00e5ff) 28%, transparent) 0%,
    rgba(0, 0, 0, 0.22) 45%,
    transparent 72%
  );
  filter: blur(1px);
  opacity: 0.7;
  z-index: 0;
  pointer-events: none;
}

.fig-bob {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: end center;
  transform-origin: 50% 92%;
  will-change: transform;
}

.fig-art {
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  object-position: bottom center;
  transform: translate(var(--fig-gaze-x, 0), var(--fig-gaze-y, 0));
  -webkit-user-drag: none;
}

.fig-zzz {
  position: absolute;
  top: 10%;
  right: 18%;
  font-size: 18px;
  font-weight: 700;
  color: var(--fig-accent-soft, #7eefff);
  opacity: 0.85;
  animation: zzz-float 1.6s ease-in-out infinite;
}

.fig-spark {
  position: absolute;
  top: 12%;
  right: 16%;
  width: 10px;
  height: 10px;
  background: var(--fig-accent, #00e5ff);
  clip-path: polygon(
    50% 0%,
    61% 35%,
    98% 35%,
    68% 57%,
    79% 91%,
    50% 70%,
    21% 91%,
    32% 57%,
    2% 35%,
    39% 35%
  );
  opacity: 0.9;
  animation: spark-pop 0.9s ease-out both;
}

.fig-root[data-motion="idle-float"] .fig-bob {
  animation: fig-breathe 3.8s ease-in-out infinite;
}

.fig-root[data-mood="sleep"] .fig-bob {
  animation: fig-sleep 3.2s ease-in-out infinite;
}

.fig-root[data-motion="happy-bounce"] .fig-bob {
  animation: fig-hop 0.55s ease-out;
}

.fig-root[data-motion="rocket-jump"] .fig-bob {
  animation: fig-plane-hop 2s cubic-bezier(0.22, 0.85, 0.28, 1) both;
}

.fig-root[data-motion="victory-burst"] .fig-bob {
  animation: fig-plane-cheer 2s cubic-bezier(0.34, 1.2, 0.64, 1) both;
}

.fig-root[data-motion="peekaboo"] .fig-bob {
  animation: fig-plane-peek 2.2s cubic-bezier(0.45, 0, 0.2, 1) both;
}

.fig-root[data-motion="sway-step"] .fig-bob {
  animation: fig-plane-sway 3.2s cubic-bezier(0.45, 0, 0.2, 1) both;
}

.fig-root[data-motion="side-hop"] .fig-bob {
  animation: fig-plane-side 2.4s cubic-bezier(0.4, 0, 0.2, 1) both;
}

.fig-root[data-motion="bow-nod"] .fig-bob {
  animation: fig-plane-bow 2.2s cubic-bezier(0.45, 0, 0.25, 1) both;
}

.fig-root[data-motion="stretch-up"] .fig-bob {
  animation: fig-plane-stretch 2.5s cubic-bezier(0.45, 0, 0.25, 1) both;
}

.fig-root[data-motion="tip-toe"] .fig-bob {
  animation: fig-plane-tiptoe 2.6s cubic-bezier(0.4, 0, 0.2, 1) both;
}

@keyframes fig-breathe {
  0%,
  100% {
    transform: translateY(0) scale(1, 1);
  }
  50% {
    transform: translateY(-5px) scale(1.012, 0.988);
  }
}

@keyframes fig-sleep {
  0%,
  100% {
    transform: translateY(2px) rotateZ(-1.2deg);
  }
  50% {
    transform: translateY(-2px) rotateZ(1deg);
  }
}

@keyframes fig-hop {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  40% {
    transform: translateY(-14px) scale(0.96, 1.04);
  }
  70% {
    transform: translateY(0) scale(1.04, 0.96);
  }
}

@keyframes fig-plane-hop {
  0% {
    transform: translateY(0) scale(1, 1);
  }
  12% {
    transform: translateY(5px) scale(1.06, 0.9);
  }
  40% {
    transform: translateY(-36px) scale(0.96, 1.04);
  }
  70% {
    transform: translateY(-6px) scale(1.02, 0.98);
  }
  100% {
    transform: translateY(0) scale(1, 1);
  }
}

@keyframes fig-plane-cheer {
  0%,
  100% {
    transform: translateY(0) rotateZ(0) scale(1);
  }
  20% {
    transform: translateY(-12px) rotateZ(-3deg) scale(1.03);
  }
  45% {
    transform: translateY(-2px) rotateZ(4deg) scale(1.02);
  }
  70% {
    transform: translateY(-16px) rotateZ(-2deg) scale(1.04);
  }
}

@keyframes fig-plane-peek {
  0%,
  100% {
    transform: translateX(0) scale(1);
    opacity: 1;
  }
  30% {
    transform: translateX(-22px) scale(0.94);
    opacity: 0.4;
  }
  55% {
    transform: translateX(12px) scale(1.02);
    opacity: 1;
  }
}

@keyframes fig-plane-sway {
  0%,
  100% {
    transform: translateX(0) rotateZ(0);
  }
  25% {
    transform: translateX(-18px) rotateZ(-4deg);
  }
  50% {
    transform: translateX(0) rotateZ(0);
  }
  75% {
    transform: translateX(18px) rotateZ(4deg);
  }
}

@keyframes fig-plane-side {
  0% {
    transform: translateX(0) translateY(0) scale(1);
  }
  20% {
    transform: translateX(-6px) translateY(4px) scale(1.04, 0.94);
  }
  45% {
    transform: translateX(22px) translateY(-20px) scale(0.98, 1.03);
  }
  70% {
    transform: translateX(8px) translateY(-4px) scale(1.02, 0.98);
  }
  100% {
    transform: translateX(0) translateY(0) scale(1);
  }
}

@keyframes fig-plane-bow {
  0%,
  100% {
    transform: translateY(0) scale(1, 1);
  }
  35% {
    transform: translateY(8px) scale(1.02, 0.9);
  }
  55% {
    transform: translateY(10px) scale(1.03, 0.86);
  }
  75% {
    transform: translateY(4px) scale(1.01, 0.95);
  }
}

@keyframes fig-plane-stretch {
  0%,
  100% {
    transform: translateY(0) scale(1, 1);
  }
  25% {
    transform: translateY(4px) scale(1.04, 0.92);
  }
  55% {
    transform: translateY(-18px) scale(0.94, 1.08);
  }
  75% {
    transform: translateY(-8px) scale(0.98, 1.03);
  }
}

@keyframes fig-plane-tiptoe {
  0%,
  100% {
    transform: translateX(0) translateY(0) scale(1, 1);
  }
  12% {
    transform: translateX(-8px) translateY(-10px) scale(0.98, 1.03);
  }
  25% {
    transform: translateX(-4px) translateY(0) scale(1.02, 0.96);
  }
  40% {
    transform: translateX(10px) translateY(-12px) scale(0.98, 1.04);
  }
  55% {
    transform: translateX(6px) translateY(0) scale(1.02, 0.96);
  }
  70% {
    transform: translateX(-6px) translateY(-8px) scale(0.99, 1.02);
  }
  85% {
    transform: translateX(4px) translateY(0) scale(1.01, 0.98);
  }
}

@keyframes zzz-float {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.55;
  }
  50% {
    transform: translateY(-8px);
    opacity: 0.95;
  }
}

@keyframes spark-pop {
  0% {
    transform: scale(0.4);
    opacity: 0;
  }
  40% {
    transform: scale(1.15);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 0.75;
  }
}
</style>
