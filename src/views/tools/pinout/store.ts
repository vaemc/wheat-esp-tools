import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type { PinInfo } from "./chips/types";
import { allCategories, primaryCategory } from "./data/categories";
import { CHIPS, CHIPS_BY_ID, DEFAULT_CHIP_ID } from "./chips/registry";

export const usePinoutStore = defineStore("pinout", () => {
  const chipId = ref<string>(DEFAULT_CHIP_ID);
  const variantId = ref<string>(CHIPS_BY_ID[DEFAULT_CHIP_ID].defaultVariant);

  const hoveredPin = ref<number | null>(null);
  const selectedPin = ref<number | null>(null);
  const activeCategories = ref<Set<string>>(new Set());
  const searchQuery = ref("");

  const chip = computed(() => CHIPS_BY_ID[chipId.value] ?? CHIPS[0]);
  const variant = computed(() => {
    const v = chip.value.variants.find((x) => x.id === variantId.value);
    return v ?? chip.value.variants[0];
  });
  const layout = computed(() => variant.value.layout);

  const pins = computed<PinInfo[]>(() => variant.value.pins);

  const pinByNumber = computed(() => {
    const map = new Map<number, PinInfo>();
    for (const p of pins.value) map.set(p.number, p);
    return map;
  });

  const pinCategories = computed(() => {
    const map = new Map<number, string[]>();
    for (const p of pins.value) map.set(p.number, allCategories(p));
    return map;
  });

  const pinPrimaryCategory = computed(() => {
    const map = new Map<number, string>();
    for (const p of pins.value) map.set(p.number, primaryCategory(p));
    return map;
  });

  const focusedPinNumber = computed(
    () => hoveredPin.value ?? selectedPin.value
  );
  const focusedPin = computed<PinInfo | null>(() => {
    const n = focusedPinNumber.value;
    if (n == null) return null;
    return pinByNumber.value.get(n) ?? null;
  });

  function setChip(id: string) {
    const next = CHIPS_BY_ID[id];
    if (!next) return;
    chipId.value = id;
    variantId.value = next.defaultVariant;
    selectedPin.value = null;
    hoveredPin.value = null;
    activeCategories.value = new Set();
  }

  function setVariant(id: string) {
    const v = chip.value.variants.find((x) => x.id === id);
    if (!v) return;
    variantId.value = id;
    selectedPin.value = null;
    hoveredPin.value = null;
  }

  function setHovered(n: number | null) {
    hoveredPin.value = n;
  }
  function setSelected(n: number | null) {
    selectedPin.value = selectedPin.value === n ? null : n;
  }
  function toggleCategory(id: string) {
    const next = new Set(activeCategories.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    activeCategories.value = next;
  }
  function clearCategories() {
    activeCategories.value = new Set();
  }

  /** A pin is dimmed when filters are active and it doesn't match any. */
  function isPinDimmed(n: number): boolean {
    const q = searchQuery.value.trim().toLowerCase();
    const cats = pinCategories.value.get(n) ?? [];
    const filtersActive = activeCategories.value.size > 0 || q.length > 0;
    if (!filtersActive) return false;

    let matchesCat = activeCategories.value.size === 0;
    if (!matchesCat) {
      for (const c of cats) {
        if (activeCategories.value.has(c)) {
          matchesCat = true;
          break;
        }
      }
    }

    let matchesQ = q.length === 0;
    if (!matchesQ) {
      const pin = pinByNumber.value.get(n);
      if (pin) {
        const hay = [
          pin.name,
          pin.type,
          pin.supply,
          ...pin.iomux.map((f) => f.name),
          ...pin.lpio.map((f) => f.name),
          ...pin.analog,
          String(pin.number),
        ]
          .join(" ")
          .toLowerCase();
        matchesQ = hay.includes(q);
      }
    }
    return !(matchesCat && matchesQ);
  }

  function isPinHighlighted(n: number): boolean {
    if (activeCategories.value.size === 0 && !searchQuery.value.trim())
      return false;
    return !isPinDimmed(n);
  }

  function reset() {
    selectedPin.value = null;
    hoveredPin.value = null;
    activeCategories.value = new Set();
    searchQuery.value = "";
  }

  return {
    chipId,
    variantId,
    chip,
    variant,
    layout,
    chips: CHIPS,
    hoveredPin,
    selectedPin,
    activeCategories,
    searchQuery,
    pins,
    pinByNumber,
    pinCategories,
    pinPrimaryCategory,
    focusedPin,
    focusedPinNumber,
    setChip,
    setVariant,
    setHovered,
    setSelected,
    toggleCategory,
    clearCategories,
    isPinDimmed,
    isPinHighlighted,
    reset,
  };
});
