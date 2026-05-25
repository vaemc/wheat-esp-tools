<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import PinElement from "./PinElement.vue";
import { usePinoutStore } from "../store";
import { pinsOnSide } from "../chips/layout";

const { t } = useI18n();
const store = usePinoutStore();
const { layout, focusedPin, chip, variant } = storeToRefs(store);

const leftPins = computed(() => pinsOnSide("left", layout.value));
const bottomPins = computed(() => pinsOnSide("bottom", layout.value));
const rightPins = computed(() => pinsOnSide("right", layout.value));
const topPins = computed(() => pinsOnSide("top", layout.value));

const centerPin = computed(() => {
  const cp = layout.value.centerPin;
  return cp == null ? null : store.pinByNumber.get(cp) ?? null;
});

const subRevisionLabel = computed(() => {
  if (chip.value.id === "esp32-p4") {
    return variant.value.id === "v3"
      ? t("pinout.chipRevV3")
      : t("pinout.chipRevV1");
  }
  return variant.value.label;
});
</script>

<template>
  <div
    class="chip-wrapper"
    :style="{
      '--pins-per-side': layout.pinsPerSide,
    }"
  >
    <div class="chip-board">
      <div class="corner corner-tl" />
      <div class="corner corner-tr" />
      <div class="corner corner-bl" />
      <div class="corner corner-br" />

      <div class="rail rail-top">
        <PinElement
          v-for="num in topPins"
          :key="num"
          :pin-number="num"
          side="top"
        />
      </div>

      <div class="middle">
        <div class="rail rail-left">
          <PinElement
            v-for="num in leftPins"
            :key="num"
            :pin-number="num"
            side="left"
          />
        </div>

        <div
          class="chip-body"
          @click="centerPin && store.setSelected(centerPin.number)"
        >
          <div class="chip-edge" />
          <div class="chip-marker" title="Pin 1 marker" />

          <div class="chip-content">
            <div class="chip-brand">ESPRESSIF</div>
            <div class="chip-title">{{ chip.name }}</div>
            <div class="chip-sub mono">{{ subRevisionLabel }}</div>
            <div class="chip-package mono">{{ layout.packageName }}</div>

            <div
              v-if="centerPin"
              class="thermal-pad"
              :class="{ active: focusedPin?.number === centerPin.number }"
            >
              <span class="thermal-num mono">{{ centerPin.number }}</span>
              <span class="thermal-name">{{ centerPin.name }}</span>
              <span class="thermal-hint">{{ t("pinout.thermalHint") }}</span>
            </div>
          </div>
        </div>

        <div class="rail rail-right">
          <PinElement
            v-for="num in rightPins"
            :key="num"
            :pin-number="num"
            side="right"
          />
        </div>
      </div>

      <div class="rail rail-bottom">
        <PinElement
          v-for="num in bottomPins"
          :key="num"
          :pin-number="num"
          side="bottom"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.chip-wrapper {
  /*
   * 让引脚行距 (--pin-step) 与「引脚深度」(--pin-depth) 随容器宽度
   * 流式缩放，且与该侧引脚总数 (--pins-per-side) 相关：
   *   - 引脚越少（如 QFN-32 = 8/侧），引脚可以画得更大
   *   - 引脚越多（如 QFN-104 = 26/侧），引脚需要更小才能放下
   */
  --pin-step-base: clamp(14px, 1.4vw, 22px);
  --pin-step-scale: max(0.55, calc(20 / var(--pins-per-side, 26)));
  --pin-step: calc(var(--pin-step-base) * var(--pin-step-scale));
  --pin-depth: clamp(110px, 12vw, 178px);
  --chip-side: calc(var(--pin-step) * var(--pins-per-side, 26) + 28px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(8px, 1.2vw, 24px);
  width: 100%;
}

@container pinout (max-width: 760px) {
  .chip-wrapper {
    --pin-step-base: 14px;
    --pin-depth: 100px;
  }
}

.chip-board {
  display: grid;
  grid-template-columns: var(--pin-depth) var(--chip-side) var(--pin-depth);
  grid-template-rows: var(--pin-depth) var(--chip-side) var(--pin-depth);
  grid-template-areas:
    ".    top    ."
    "left chip   right"
    ".    bottom .";
  position: relative;
}

.corner {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(circle, #2a3656 0%, #16203a 70%);
  box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.18);
}
.corner-tl {
  top: var(--pin-depth);
  left: var(--pin-depth);
  transform: translate(-50%, -50%);
}
.corner-tr {
  top: var(--pin-depth);
  right: var(--pin-depth);
  transform: translate(50%, -50%);
}
.corner-bl {
  bottom: var(--pin-depth);
  left: var(--pin-depth);
  transform: translate(-50%, 50%);
}
.corner-br {
  bottom: var(--pin-depth);
  right: var(--pin-depth);
  transform: translate(50%, 50%);
}

.middle {
  grid-area: chip;
  display: contents;
}

.rail-top {
  grid-area: top;
}
.rail-left {
  grid-area: left;
}
.rail-right {
  grid-area: right;
}
.rail-bottom {
  grid-area: bottom;
}

.rail {
  display: flex;
}

.rail-left,
.rail-right {
  flex-direction: column;
  justify-content: space-between;
  padding: 14px 0;
}

.rail-top,
.rail-bottom {
  flex-direction: row;
  justify-content: space-between;
  padding: 0 14px;
}

.chip-body {
  grid-area: chip;
  position: relative;
  border-radius: 28px;
  background:
    radial-gradient(
      120% 120% at 0% 0%,
      rgba(148, 163, 184, 0.12),
      transparent 50%
    ),
    linear-gradient(155deg, #16203a 0%, #0b1224 50%, #16203a 100%);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.6),
    inset 0 6px 30px rgba(0, 0, 0, 0.6),
    0 30px 80px -20px rgba(0, 0, 0, 0.7);
  cursor: default;
  overflow: hidden;
}

.chip-edge {
  position: absolute;
  inset: 14px;
  border-radius: 18px;
  border: 1px dashed rgba(148, 163, 184, 0.14);
  pointer-events: none;
}

.chip-marker {
  position: absolute;
  top: 24px;
  left: 24px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    #cbd5e1 0%,
    #475569 70%,
    transparent 100%
  );
  box-shadow:
    0 0 0 1px rgba(203, 213, 225, 0.4),
    0 0 12px rgba(203, 213, 225, 0.45);
}

.chip-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-align: center;
  pointer-events: none;
}

.chip-brand {
  font-size: 11px;
  letter-spacing: 0.5em;
  font-weight: 600;
  color: rgba(203, 213, 225, 0.55);
  padding-left: 0.5em;
}

.chip-title {
  font-size: clamp(22px, 2.6vw, 40px);
  font-weight: 700;
  letter-spacing: 0.06em;
  background: linear-gradient(
    135deg,
    #f1f5f9 0%,
    #93c5fd 50%,
    #c4b5fd 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 8px 30px rgba(56, 189, 248, 0.25);
}

.chip-sub {
  font-size: 11px;
  color: var(--pinout-text-2);
  letter-spacing: 0.12em;
}

.chip-package {
  font-size: 10px;
  color: var(--pinout-text-3);
  letter-spacing: 0.18em;
}

.thermal-pad {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 20px;
  border-radius: 14px;
  background: linear-gradient(
    135deg,
    rgba(245, 158, 11, 0.08),
    rgba(245, 158, 11, 0.02)
  );
  border: 1px dashed rgba(245, 158, 11, 0.35);
  pointer-events: auto;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;
}

.thermal-pad:hover,
.thermal-pad.active {
  background: linear-gradient(
    135deg,
    rgba(245, 158, 11, 0.22),
    rgba(245, 158, 11, 0.08)
  );
  border-color: rgba(245, 158, 11, 0.8);
  transform: scale(1.02);
}

.thermal-num {
  font-size: 10px;
  color: rgba(245, 158, 11, 0.85);
}

.thermal-name {
  font-size: 14px;
  font-weight: 600;
  color: #fbbf24;
  letter-spacing: 0.08em;
}

.thermal-hint {
  font-size: 10px;
  color: var(--pinout-text-3);
}

.mono {
  font-family: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas,
    monospace;
  font-feature-settings: "zero", "ss01";
}
</style>
