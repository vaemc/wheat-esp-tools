<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { usePinoutStore } from "../store";
import { CATEGORY_BY_ID } from "../data/categories";
import type { PinSide } from "../chips/types";

const props = defineProps<{
  pinNumber: number;
  side: PinSide;
}>();

const store = usePinoutStore();
const { pinByNumber, pinPrimaryCategory, hoveredPin, selectedPin } =
  storeToRefs(store);

const pin = computed(() => pinByNumber.value.get(props.pinNumber));
const category = computed(
  () =>
    CATEGORY_BY_ID[pinPrimaryCategory.value.get(props.pinNumber) ?? "gpio"]!,
);
const isHovered = computed(() => hoveredPin.value === props.pinNumber);
const isSelected = computed(() => selectedPin.value === props.pinNumber);
const isDimmed = computed(() => store.isPinDimmed(props.pinNumber));
const isHighlighted = computed(() => store.isPinHighlighted(props.pinNumber));

const shortName = computed(() => {
  const n = pin.value?.name ?? "?";
  return n.length > 22 ? n.slice(0, 20) + "…" : n;
});
</script>

<template>
  <div
    class="pin-slot"
    :class="[`pin-slot-${side}`]"
    @mouseenter="store.setHovered(pinNumber)"
    @mouseleave="store.setHovered(null)"
    @click="store.setSelected(pinNumber)"
  >
    <div
      class="pin"
      :class="[
        `pin-${side}`,
        {
          'pin-hovered': isHovered,
          'pin-selected': isSelected,
          'pin-dimmed': isDimmed,
          'pin-highlighted': isHighlighted,
        },
      ]"
      :style="
        ({
          '--cat-color': category.color,
          '--cat-text': category.textColor,
        } as Record<string, string>)
      "
      :title="`#${pinNumber} ${pin?.name ?? '—'}`"
    >
      <span class="pin-pad" />
      <span class="pin-num mono">{{ pinNumber }}</span>
      <span class="pin-name">{{ shortName }}</span>
    </div>
  </div>
</template>

<style scoped>
.pin-slot {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pin-slot-left,
.pin-slot-right {
  width: 100%;
  height: var(--pin-step, 22px);
}

.pin-slot-top,
.pin-slot-bottom {
  width: var(--pin-step, 22px);
  height: 100%;
}

.pin {
  --pad-color: var(--cat-color, #475569);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px;
  height: 18px;
  width: 100%;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease,
    opacity 0.2s ease;
  user-select: none;
}

.pin-left {
  flex-direction: row-reverse;
  text-align: right;
  padding-right: 0;
}

.pin-right {
  flex-direction: row;
  padding-left: 0;
}

.pin-top,
.pin-bottom {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--pin-depth, 180px);
  height: 18px;
  flex-direction: row;
  padding-left: 0;
}

.pin-top {
  transform: translate(-50%, -50%) rotate(-90deg);
}

.pin-bottom {
  transform: translate(-50%, -50%) rotate(90deg);
}

.pin-pad {
  display: block;
  width: 14px;
  height: 6px;
  border-radius: 2px;
  background: var(--pad-color);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.5) inset,
    0 0 8px -2px var(--pad-color);
  flex-shrink: 0;
}

.pin-num {
  font-size: 10px;
  color: var(--pinout-text-3);
  width: 22px;
  text-align: center;
  flex-shrink: 0;
  letter-spacing: 0;
}

.pin-name {
  font-size: 11.5px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--pinout-text-1);
  flex: 1 1 auto;
  min-width: 0;
}

.pin:hover,
.pin-hovered {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 0%,
    color-mix(in srgb, var(--cat-color) 22%, transparent) 100%
  );
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--cat-color) 55%, transparent),
    0 6px 20px -8px var(--cat-color);
}

.pin-right.pin-hovered,
.pin-right:hover,
.pin-bottom.pin-hovered,
.pin-bottom:hover {
  background: linear-gradient(
    270deg,
    rgba(255, 255, 255, 0.04) 0%,
    color-mix(in srgb, var(--cat-color) 22%, transparent) 100%
  );
}

.pin-selected {
  background: color-mix(
    in srgb,
    var(--cat-color) 30%,
    transparent
  ) !important;
  box-shadow:
    0 0 0 1.5px var(--cat-color),
    0 8px 24px -6px var(--cat-color) !important;
}

.pin-selected .pin-pad {
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.4) inset,
    0 0 12px 2px var(--cat-color);
}

.pin-selected .pin-name,
.pin-hovered .pin-name {
  color: var(--pinout-text-0);
  font-weight: 600;
}

.pin-highlighted .pin-pad {
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.4) inset,
    0 0 14px 2px var(--cat-color);
}

.pin-dimmed {
  opacity: 0.18;
  filter: saturate(0.4);
}

.pin-dimmed:hover {
  opacity: 0.9;
  filter: none;
}

.mono {
  font-family: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas,
    monospace;
  font-feature-settings: "zero", "ss01";
}
</style>
