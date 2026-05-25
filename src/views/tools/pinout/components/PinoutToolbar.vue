<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { usePinoutStore } from "../store";
import { CHIPS } from "../chips/registry";

const { t } = useI18n();
const store = usePinoutStore();
const { searchQuery, chip, chipId, variantId } = storeToRefs(store);

// CHIPS 是静态注册表，不需要走 store
const chipOptions = CHIPS.map((c) => ({ value: c.id, label: c.name }));

function onChipChange(value: string | number | unknown) {
  if (typeof value === "string") store.setChip(value);
}
</script>

<template>
  <header class="pinout-toolbar">
    <div class="brand">
      <div class="logo">
        <svg viewBox="0 0 24 24" fill="none">
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="4"
            stroke="url(#g1)"
            stroke-width="2"
          />
          <rect x="7" y="7" width="10" height="10" rx="1.5" fill="url(#g2)" />
          <path
            d="M1 7v2M1 11v2M1 15v2M23 7v2M23 11v2M23 15v2M7 1h2M11 1h2M15 1h2M7 23h2M11 23h2M15 23h2"
            stroke="url(#g1)"
            stroke-width="1.6"
            stroke-linecap="round"
          />
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="24" y2="24">
              <stop offset="0" stop-color="#38bdf8" />
              <stop offset="1" stop-color="#a78bfa" />
            </linearGradient>
            <linearGradient id="g2" x1="0" y1="0" x2="24" y2="24">
              <stop offset="0" stop-color="#38bdf8" />
              <stop offset="1" stop-color="#ec4899" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div class="brand-text">
        <h1>{{ t("pinout.title") }}</h1>
        <p>{{ t("pinout.subtitle") }}</p>
      </div>
    </div>

    <div class="controls">
      <div class="search">
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('pinout.searchPlaceholder')"
          spellcheck="false"
        />
        <button
          v-if="searchQuery"
          class="search-clear"
          :title="t('pinout.clearSearch')"
          @click="searchQuery = ''"
        >
          ×
        </button>
      </div>

      <div class="chip-select">
        <span class="select-label">{{ t("pinout.chipLabel") }}</span>
        <a-select
          class="chip-dropdown"
          :value="chipId"
          :options="chipOptions"
          :bordered="false"
          size="small"
          dropdown-class-name="pinout-chip-dropdown"
          @change="onChipChange"
        />
      </div>

      <div v-if="chip.variants.length > 1" class="version-switch">
        <button
          v-for="v in chip.variants"
          :key="v.id"
          class="ver-btn"
          :class="{ active: variantId === v.id }"
          @click="store.setVariant(v.id)"
        >
          {{ v.label }}
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.pinout-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: clamp(10px, 1vw, 14px) clamp(12px, 1.4vw, 18px);
  gap: clamp(12px, 1.6vw, 24px);
  flex-wrap: wrap;
  border: 1px solid var(--pinout-border);
  background: rgba(10, 14, 26, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: var(--pinout-radius);
  min-width: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex-shrink: 1;
}

.brand-text {
  min-width: 0;
}

.logo {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.brand h1 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
  background: linear-gradient(135deg, #f1f5f9 0%, #93c5fd 70%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.brand p {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--pinout-text-3);
  letter-spacing: 0.04em;
}

.controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex: 1 1 320px;
  min-width: 0;
  justify-content: flex-end;
}

.search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.06);
  border: 1px solid var(--pinout-border);
  flex: 1 1 220px;
  min-width: 180px;
  max-width: 420px;
  transition: all 0.15s ease;
  color: var(--pinout-text-2);
}

.search:focus-within {
  background: rgba(148, 163, 184, 0.1);
  border-color: var(--pinout-accent);
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
  color: var(--pinout-accent);
}

.search input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 13px;
  color: var(--pinout-text-0);
  font-family: inherit;
}

.search input::placeholder {
  color: var(--pinout-text-3);
}

.search-clear {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.2);
  color: var(--pinout-text-1);
  font-size: 14px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  cursor: pointer;
}

.search-clear:hover {
  background: rgba(148, 163, 184, 0.4);
}

.chip-select {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px 4px 12px;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.06);
  border: 1px solid var(--pinout-border);
  flex-shrink: 0;
  min-width: 160px;
  transition: border-color 0.15s ease;
}

.chip-select:hover,
.chip-select:focus-within {
  border-color: var(--pinout-accent);
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
}

.select-label {
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--pinout-text-3);
  white-space: nowrap;
  user-select: none;
}

.chip-dropdown {
  flex: 1;
  min-width: 100px;
}

/* Restyle the inline ant-design-vue select inside the toolbar */
.chip-select :deep(.ant-select-selector) {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 24px 0 4px !important;
  height: auto !important;
}

.chip-select :deep(.ant-select-selection-item) {
  font-size: 13px;
  font-weight: 600;
  color: var(--pinout-text-0);
  line-height: 22px;
}

.chip-select :deep(.ant-select-arrow) {
  color: var(--pinout-text-3);
  right: 6px;
}

.chip-select :deep(.ant-select-focused) .ant-select-selection-item {
  color: var(--pinout-accent);
}

.version-switch {
  display: flex;
  background: rgba(148, 163, 184, 0.06);
  border: 1px solid var(--pinout-border);
  border-radius: 10px;
  padding: 3px;
  gap: 2px;
  flex-shrink: 0;
}

.ver-btn {
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 7px;
  color: var(--pinout-text-2);
  letter-spacing: 0.04em;
  transition: all 0.15s ease;
  border: none;
  background: none;
  cursor: pointer;
  font-family: inherit;
}

.ver-btn:hover {
  color: var(--pinout-text-0);
}

.ver-btn.active {
  background: linear-gradient(
    135deg,
    var(--pinout-accent),
    var(--pinout-accent-2)
  );
  color: white;
  box-shadow: 0 4px 12px -4px var(--pinout-accent);
}

/* 容器较窄时：副标题先消失，再消失全部品牌文字，只留 logo */
@container pinout (max-width: 900px) {
  .brand p {
    display: none;
  }
}

@container pinout (max-width: 600px) {
  .brand-text {
    display: none;
  }
  .pinout-toolbar {
    gap: 10px;
  }
}

/* 不支持容器查询的浏览器使用视口媒体查询 */
@supports not (container-type: inline-size) {
  @media (max-width: 900px) {
    .brand p {
      display: none;
    }
  }
  @media (max-width: 600px) {
    .brand-text {
      display: none;
    }
  }
}
</style>

<!-- 非 scoped，用于覆盖被 Teleport 到 body 的 a-select 下拉浮层 -->
<style>
.pinout-chip-dropdown.ant-select-dropdown {
  background: rgba(17, 23, 41, 0.96);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 12px;
  padding: 4px;
  box-shadow:
    0 12px 36px -8px rgba(0, 0, 0, 0.55),
    0 0 0 1px rgba(56, 189, 248, 0.1);
}

.pinout-chip-dropdown .ant-select-item {
  color: #cbd5e1;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.pinout-chip-dropdown .ant-select-item-option-active:not(.ant-select-item-option-disabled) {
  background: rgba(56, 189, 248, 0.12);
  color: #f1f5f9;
}

.pinout-chip-dropdown .ant-select-item-option-selected:not(.ant-select-item-option-disabled) {
  background: linear-gradient(
    135deg,
    rgba(56, 189, 248, 0.22),
    rgba(129, 140, 248, 0.22)
  );
  color: #f8fafc;
  font-weight: 600;
}
</style>
