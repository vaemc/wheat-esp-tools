<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { usePinoutStore } from "../store";
import { CATEGORIES, CATEGORY_BY_ID } from "../data/categories";

const { t } = useI18n();
const store = usePinoutStore();
const { focusedPin } = storeToRefs(store);

const categories = computed(() => {
  if (!focusedPin.value) return [];
  return CATEGORIES.filter((c) => c.match(focusedPin.value!)).map((c) => c);
});

const isHovering = computed(() => store.hoveredPin !== null);
</script>

<template>
  <aside class="panel glass">
    <div v-if="!focusedPin" class="empty">
      <div class="empty-icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
        >
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M3 9h18M9 3v18" />
        </svg>
      </div>
      <h3>{{ t("pinout.detailEmptyTitle") }}</h3>
      <p>{{ t("pinout.detailEmptyHint") }}</p>
    </div>

    <div v-else class="content">
      <header class="head">
        <div class="head-top">
          <span class="pin-no mono">#{{ focusedPin.number }}</span>
          <span class="state">{{
            isHovering ? t("pinout.stateHover") : t("pinout.stateSelected")
          }}</span>
        </div>
        <h2 class="pin-title">{{ focusedPin.name }}</h2>
        <div class="meta-row">
          <span class="meta-pill">{{ focusedPin.type || "—" }}</span>
          <span v-if="focusedPin.supply" class="meta-pill meta-supply">
            <svg
              viewBox="0 0 24 24"
              width="11"
              height="11"
              fill="currentColor"
            >
              <path
                d="M11 21h-1l1-7H6.5a.5.5 0 0 1-.4-.8L13 3h1l-1 7h4.5a.5.5 0 0 1 .4.8L11 21Z"
              />
            </svg>
            {{ focusedPin.supply }}
          </span>
        </div>
      </header>

      <section v-if="categories.length" class="block">
        <h4 class="block-title">{{ t("pinout.sectionCategories") }}</h4>
        <div class="chips">
          <span
            v-for="c in categories"
            :key="c.id"
            class="chip"
            :style="{ background: c.color, color: c.textColor }"
            :title="c.description"
          >
            {{ c.label }}
          </span>
        </div>
      </section>

      <section v-if="focusedPin.strapping" class="block boot-block">
        <h4 class="block-title">
          {{ t("pinout.sectionBoot") }}
          <span class="block-badge boot-badge-pill">BOOT</span>
        </h4>
        <p class="boot-purpose">{{ focusedPin.strapping.purpose }}</p>
        <div v-if="focusedPin.strapping.default !== undefined" class="kv-grid">
          <div class="kv">
            <span class="k">{{ t("pinout.bootDefault") }}</span>
            <span class="v mono">{{ focusedPin.strapping.default }}</span>
          </div>
          <div class="kv">
            <span class="k">{{ t("pinout.bootSampleAt") }}</span>
            <span class="v">{{ t("pinout.bootSampleAtValue") }}</span>
          </div>
        </div>
        <p class="boot-hint">{{ t("pinout.bootHint") }}</p>
      </section>

      <section
        v-if="focusedPin.resetAt || focusedPin.resetAfter"
        class="block"
      >
        <h4 class="block-title">{{ t("pinout.sectionReset") }}</h4>
        <div class="kv-grid">
          <div class="kv">
            <span class="k">{{ t("pinout.resetAt") }}</span>
            <span class="v mono">{{ focusedPin.resetAt || "—" }}</span>
          </div>
          <div class="kv">
            <span class="k">{{ t("pinout.resetAfter") }}</span>
            <span class="v mono">{{ focusedPin.resetAfter || "—" }}</span>
          </div>
        </div>
      </section>

      <section v-if="focusedPin.iomux.length" class="block">
        <h4 class="block-title">{{ t("pinout.sectionIomux") }}</h4>
        <div class="func-table">
          <div
            v-for="f in focusedPin.iomux"
            :key="f.f"
            class="func-row"
          >
            <span class="func-tag">{{ f.f }}</span>
            <span class="func-name mono">{{ f.name }}</span>
            <span class="func-type">{{ f.type }}</span>
          </div>
        </div>
      </section>

      <section v-if="focusedPin.lpio.length" class="block">
        <h4 class="block-title">
          {{ t("pinout.sectionLpio") }}
          <span
            class="block-badge"
            :style="{
              background: CATEGORY_BY_ID.lp!.color + '22',
              color: CATEGORY_BY_ID.lp!.color,
            }"
          >
            {{ t("pinout.lpBadge") }}
          </span>
        </h4>
        <div class="func-table">
          <div v-for="f in focusedPin.lpio" :key="f.f" class="func-row">
            <span
              class="func-tag"
              :style="{ background: CATEGORY_BY_ID.lp!.color }"
            >
              {{ f.f }}
            </span>
            <span class="func-name mono">{{ f.name }}</span>
            <span class="func-type">{{ f.type }}</span>
          </div>
        </div>
      </section>

      <section v-if="focusedPin.analog.length" class="block">
        <h4 class="block-title">{{ t("pinout.sectionAnalog") }}</h4>
        <div class="analog-list">
          <span
            v-for="(a, i) in focusedPin.analog"
            :key="i"
            class="analog-tag mono"
          >
            {{ a }}
          </span>
        </div>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.panel {
  width: 100%;
  max-width: 100%;
  max-height: clamp(360px, 70vh, calc(100vh - 220px));
  overflow-y: auto;
  padding: clamp(14px, 1.4vw, 22px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 60px 20px;
  color: var(--pinout-text-2);
  height: 100%;
}

.empty-icon {
  width: 52px;
  height: 52px;
  color: var(--pinout-text-3);
  margin-bottom: 18px;
  opacity: 0.6;
}

.empty h3 {
  margin: 0 0 8px;
  font-size: 16px;
  color: var(--pinout-text-1);
  font-weight: 600;
}

.empty p {
  font-size: 13px;
  line-height: 1.6;
  color: var(--pinout-text-3);
  max-width: 280px;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 18px;
  animation: pop 0.25s ease;
}

@keyframes pop {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.head {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--pinout-border);
}

.head-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pin-no {
  font-size: 12px;
  font-weight: 600;
  color: var(--pinout-text-3);
  letter-spacing: 0.08em;
}

.state {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.12);
  color: var(--pinout-accent);
  font-weight: 600;
  letter-spacing: 0.08em;
}

.pin-title {
  margin: 0;
  font-size: clamp(20px, 1.6vw, 26px);
  font-weight: 700;
  letter-spacing: 0.02em;
  background: linear-gradient(135deg, #f1f5f9, #cbd5e1);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  word-break: break-word;
}

.meta-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.1);
  border: 1px solid var(--pinout-border);
  font-size: 11px;
  color: var(--pinout-text-1);
  font-weight: 500;
}

.meta-supply {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
  color: #fbbf24;
}

.block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.block-title {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--pinout-text-2);
  display: flex;
  align-items: center;
  gap: 8px;
}

.block-badge {
  font-size: 9px;
  padding: 2px 7px;
  border-radius: 999px;
  letter-spacing: 0.08em;
  text-transform: none;
}

.boot-block {
  padding: 12px 14px;
  border: 1px solid rgba(220, 38, 38, 0.35);
  background: linear-gradient(
    180deg,
    rgba(220, 38, 38, 0.07) 0%,
    rgba(220, 38, 38, 0.02) 100%
  );
  border-radius: 12px;
}

.boot-badge-pill {
  background: #dc2626;
  color: #ffffff;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.boot-purpose {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--pinout-text-0);
  font-weight: 500;
}

.boot-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.55;
  color: var(--pinout-text-3);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.kv-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.kv {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: rgba(148, 163, 184, 0.05);
  border: 1px solid var(--pinout-border);
  border-radius: 10px;
}

.kv .k {
  font-size: 10px;
  color: var(--pinout-text-3);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.kv .v {
  font-size: 12px;
  color: var(--pinout-text-0);
  font-weight: 600;
}

.func-table {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.func-row {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.04);
  border: 1px solid var(--pinout-border);
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.func-row:hover {
  background: rgba(148, 163, 184, 0.1);
  border-color: var(--pinout-border-strong);
}

.func-tag {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 0;
  border-radius: 4px;
  text-align: center;
  background: #1e293b;
  color: var(--pinout-text-0);
}

.func-name {
  font-size: 12px;
  color: var(--pinout-text-0);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
}

.func-type {
  font-size: 10px;
  color: var(--pinout-text-3);
  font-family: "JetBrains Mono", monospace;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.18);
  color: var(--pinout-accent);
  letter-spacing: 0.05em;
}

.analog-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.analog-tag {
  font-size: 11px;
  padding: 5px 10px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  border-radius: 6px;
  font-weight: 600;
}

.mono {
  font-family: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas,
    monospace;
}
</style>
