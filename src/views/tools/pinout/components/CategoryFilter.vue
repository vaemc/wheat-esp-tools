<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { usePinoutStore } from "../store";
import { CATEGORIES } from "../data/categories";

const { t } = useI18n();
const store = usePinoutStore();
const { activeCategories } = storeToRefs(store);

const counts = computed(() => {
  const map = new Map<string, number>();
  for (const cat of CATEGORIES) map.set(cat.id, 0);
  for (const pin of store.pins) {
    for (const c of CATEGORIES) {
      if (c.match(pin)) map.set(c.id, (map.get(c.id) ?? 0) + 1);
    }
  }
  return map;
});

const anyActive = computed(() => activeCategories.value.size > 0);
</script>

<template>
  <div class="filter glass">
    <header class="filter-head">
      <div>
        <h3>{{ t("pinout.legendTitle") }}</h3>
        <p class="hint">{{ t("pinout.legendHint") }}</p>
      </div>
      <button v-if="anyActive" class="clear" @click="store.clearCategories">
        {{ t("pinout.clearFilter") }}
      </button>
    </header>

    <div class="cats">
      <button
        v-for="cat in CATEGORIES"
        :key="cat.id"
        class="cat"
        :class="{ active: activeCategories.has(cat.id) }"
        :style="({ '--c': cat.color } as Record<string, string>)"
        :title="cat.description"
        @click="store.toggleCategory(cat.id)"
      >
        <span class="dot" />
        <span class="label">{{ cat.label }}</span>
        <span class="count mono">{{ counts.get(cat.id) ?? 0 }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.filter {
  padding: clamp(14px, 1.2vw, 20px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  min-width: 0;
}

.filter-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

h3 {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--pinout-text-0);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.hint {
  margin: 0;
  font-size: 11px;
  color: var(--pinout-text-3);
}

.clear {
  font-size: 11px;
  padding: 5px 10px;
  border-radius: 6px;
  background: rgba(56, 189, 248, 0.1);
  color: var(--pinout-accent);
  border: 1px solid rgba(56, 189, 248, 0.25);
  transition: background 0.15s ease;
  cursor: pointer;
}

.clear:hover {
  background: rgba(56, 189, 248, 0.2);
}

.cats {
  display: grid;
  /* 当列宽超过 140px 时铺两列，更窄时自动塌缩为单列 */
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 6px;
}

.cat {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.05);
  border: 1px solid var(--pinout-border);
  text-align: left;
  transition: all 0.15s ease;
  min-width: 0;
  cursor: pointer;
  color: inherit;
}

.cat:hover {
  background: rgba(148, 163, 184, 0.1);
  border-color: var(--pinout-border-strong);
}

.cat.active {
  background: color-mix(in srgb, var(--c) 18%, transparent);
  border-color: var(--c);
  box-shadow: 0 6px 16px -8px var(--c);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--c);
  box-shadow: 0 0 8px var(--c);
  flex-shrink: 0;
}

.label {
  font-size: 11.5px;
  color: var(--pinout-text-1);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat.active .label {
  color: var(--pinout-text-0);
  font-weight: 600;
}

.count {
  font-size: 10px;
  color: var(--pinout-text-3);
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.3);
  min-width: 26px;
  text-align: center;
}

.cat.active .count {
  background: var(--c);
  color: white;
}

.mono {
  font-family: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas,
    monospace;
}
</style>
