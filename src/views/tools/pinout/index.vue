<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import PinoutToolbar from "./components/PinoutToolbar.vue";
import ChipView from "./components/ChipView.vue";
import PinDetailPanel from "./components/PinDetailPanel.vue";
import CategoryFilter from "./components/CategoryFilter.vue";
import { usePinoutStore } from "./store";

const { t } = useI18n();
const store = usePinoutStore();
const { chip, layout, pins } = storeToRefs(store);
</script>

<template>
  <div class="pinout-root">
    <PinoutToolbar class="pinout-header" />

    <main class="pinout-layout">
      <aside class="left-pane">
        <CategoryFilter />

        <div class="legend glass">
          <h3>{{ t("pinout.tipsTitle") }}</h3>
          <ul>
            <li>
              <kbd>{{ t("pinout.kbdHover") }}</kbd>
              {{ t("pinout.tipHover") }}
            </li>
            <li>
              <kbd>{{ t("pinout.kbdClick") }}</kbd>
              {{ t("pinout.tipClick") }}
            </li>
            <li>
              <kbd>{{ t("pinout.kbdCategory") }}</kbd>
              {{ t("pinout.tipCategory") }}
            </li>
            <li>
              <kbd>{{ t("pinout.kbdSearch") }}</kbd>
              {{ t("pinout.tipSearch") }}
            </li>
          </ul>
        </div>
      </aside>

      <section class="chip-pane">
        <ChipView />
      </section>

      <div class="detail-pane">
        <PinDetailPanel />
      </div>
    </main>

    <footer class="pinout-footer">
      <span class="footer-left">
        <span class="footer-pkg mono">{{ layout.packageName }}</span>
        <span class="footer-meta">
          {{ t("pinout.cpu") }}: <em>{{ chip.cpu }}</em>
        </span>
        <span class="footer-meta">
          {{ t("pinout.footerCount", { n: pins.length }) }}
        </span>
      </span>
    </footer>
  </div>
</template>

<style scoped>
/* ----------------------------------------------------------------- */
/*  Theme variables 范围在 .pinout-root，避免污染全局                 */
/* ----------------------------------------------------------------- */
.pinout-root {
  --pinout-bg-0: #0a0e1a;
  --pinout-bg-1: #111729;
  --pinout-bg-2: #1a2238;
  --pinout-bg-glass: rgba(26, 34, 56, 0.65);
  --pinout-border: rgba(148, 163, 184, 0.18);
  --pinout-border-strong: rgba(148, 163, 184, 0.32);
  --pinout-text-0: #f1f5f9;
  --pinout-text-1: #cbd5e1;
  --pinout-text-2: #94a3b8;
  --pinout-text-3: #64748b;
  --pinout-accent: #38bdf8;
  --pinout-accent-2: #818cf8;
  --pinout-radius: 14px;
  /* 子组件兼容别名 */
  --bg-glass: var(--pinout-bg-glass);
  --border: var(--pinout-border);
  --border-strong: var(--pinout-border-strong);
  --text-0: var(--pinout-text-0);
  --text-1: var(--pinout-text-1);
  --text-2: var(--pinout-text-2);
  --text-3: var(--pinout-text-3);
  --accent: var(--pinout-accent);
  --accent-2: var(--pinout-accent-2);
  --radius: var(--pinout-radius);

  /* 侧栏 / 详情面板宽度的弹性变量，由媒体查询调整 */
  --side-min: 280px;
  --side-pref: 320px;
  --side-max: 360px;

  display: flex;
  flex-direction: column;
  min-height: 100%;
  width: 100%;
  padding: clamp(10px, 1.2vw, 20px);
  gap: clamp(10px, 1vw, 16px);
  background:
    radial-gradient(
      1200px 800px at 8% -10%,
      rgba(56, 189, 248, 0.18),
      transparent 60%
    ),
    radial-gradient(
      900px 600px at 100% 0%,
      rgba(129, 140, 248, 0.16),
      transparent 60%
    ),
    radial-gradient(
      800px 500px at 50% 110%,
      rgba(236, 72, 153, 0.12),
      transparent 60%
    ),
    linear-gradient(180deg, var(--pinout-bg-0) 0%, var(--pinout-bg-1) 100%);
  color: var(--pinout-text-0);
  font-family:
    "Inter", "PingFang SC", "Microsoft YaHei", system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;
  /* 启用 container query，使子组件可以基于容器尺寸响应 */
  container-type: inline-size;
  container-name: pinout;
  overflow-x: hidden;
}

.pinout-root :deep(.glass) {
  background: var(--pinout-bg-glass);
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  border: 1px solid var(--pinout-border);
  border-radius: var(--pinout-radius);
}

/* ----------------------------------------------------------------- */
/*  主区域布局                                                        */
/*  默认（≥1500px）：三栏  filter | chip | detail                     */
/* ----------------------------------------------------------------- */
.pinout-layout {
  flex: 1;
  display: grid;
  grid-template-columns:
    minmax(var(--side-min), var(--side-max))
    minmax(0, 1fr)
    minmax(var(--side-min), var(--side-max));
  grid-template-areas: "filter chip detail";
  align-items: flex-start;
  gap: clamp(10px, 1vw, 18px);
  min-height: 0;
}

.left-pane {
  grid-area: filter;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.chip-pane {
  grid-area: chip;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  overflow: auto;
  border-radius: var(--pinout-radius);
  background:
    radial-gradient(
      60% 50% at 50% 50%,
      rgba(56, 189, 248, 0.06),
      transparent 70%
    ),
    rgba(10, 14, 26, 0.4);
  border: 1px solid var(--pinout-border);
  padding: clamp(6px, 0.8vw, 12px);
  min-height: clamp(420px, 60vh, 720px);
}

.detail-pane {
  grid-area: detail;
  min-width: 0;
}

.legend {
  padding: 14px 18px;
  width: 100%;
}

.legend h3 {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--pinout-text-2);
}

.legend ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
  color: var(--pinout-text-1);
}

kbd {
  display: inline-block;
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 600;
  font-family: "JetBrains Mono", monospace;
  background: rgba(56, 189, 248, 0.1);
  color: var(--pinout-accent);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 4px;
  margin-right: 6px;
}

.pinout-footer {
  display: flex;
  justify-content: space-between;
  padding: 8px 14px;
  font-size: 11px;
  color: var(--pinout-text-3);
  border: 1px solid var(--pinout-border);
  border-radius: var(--pinout-radius);
  background: rgba(10, 14, 26, 0.6);
  flex-wrap: wrap;
  gap: 8px;
}

.pinout-footer em {
  font-style: normal;
  color: var(--pinout-text-1);
  font-weight: 600;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.footer-pkg {
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(56, 189, 248, 0.1);
  color: var(--pinout-accent);
  font-size: 10px;
  letter-spacing: 0.06em;
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.footer-meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.mono {
  font-family: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas,
    monospace;
}

/* ----------------------------------------------------------------- */
/*  响应式断点（基于 container 宽度）                                 */
/*                                                                    */
/*  ≥1500px : 三栏  filter | chip | detail                            */
/*  1200-1500: 两栏  chip | detail；filter 在底部横向铺开              */
/*  900-1200 : 两栏  chip | detail（更紧凑）；filter 在底部             */
/*  600-900  : 单栏  chip → detail → filter                           */
/*  <600px   : 单栏  紧凑模式，隐藏使用提示                            */
/* ----------------------------------------------------------------- */
@container pinout (max-width: 1500px) {
  .pinout-root {
    --side-min: 260px;
    --side-pref: 300px;
    --side-max: 340px;
  }
  .pinout-layout {
    grid-template-columns:
      minmax(0, 1fr)
      minmax(var(--side-min), var(--side-max));
    grid-template-rows: auto auto;
    grid-template-areas:
      "chip   detail"
      "filter detail";
  }
  .left-pane {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 12px;
  }
  .left-pane > * {
    flex: 1 1 280px;
    min-width: 0;
  }
}

@container pinout (max-width: 1200px) {
  .pinout-root {
    --side-min: 240px;
    --side-max: 320px;
  }
  .chip-pane {
    min-height: clamp(380px, 52vh, 600px);
  }
}

@container pinout (max-width: 900px) {
  .pinout-layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto auto;
    grid-template-areas:
      "chip"
      "detail"
      "filter";
  }
  .chip-pane {
    min-height: 360px;
  }
}

@container pinout (max-width: 600px) {
  .pinout-root {
    padding: 8px;
    gap: 8px;
  }
  .left-pane {
    flex-direction: column;
  }
  .legend {
    display: none;
  }
}

/* 极窄场景：保留底部信息能在多行排列 */
@container pinout (max-width: 480px) {
  .pinout-footer {
    font-size: 10px;
    padding: 6px 10px;
  }
}

/* 浏览器不支持 container queries 时退回 viewport media queries */
@supports not (container-type: inline-size) {
  @media (max-width: 1500px) {
    .pinout-layout {
      grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
      grid-template-rows: auto auto;
      grid-template-areas:
        "chip   detail"
        "filter detail";
    }
    .left-pane {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 12px;
    }
    .left-pane > * {
      flex: 1 1 280px;
    }
  }
  @media (max-width: 900px) {
    .pinout-layout {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas:
        "chip"
        "detail"
        "filter";
    }
  }
  @media (max-width: 600px) {
    .legend {
      display: none;
    }
  }
}
</style>
