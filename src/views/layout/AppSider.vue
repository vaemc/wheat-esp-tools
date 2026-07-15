<template>
  <aside class="app-sider">
    <div class="sider-brand">
      <button
        type="button"
        class="brand-logo-btn"
        @click="showSplash"
      >
        <img class="brand-logo" src="/logo.png" alt="" />
      </button>
      <div class="brand-text">
        <div class="brand-name">{{ t("menu.appName") }}</div>
        <div class="brand-tagline">{{ t("menu.appTagline") }}</div>
      </div>
    </div>

    <nav class="sider-nav" aria-label="main">
      <section
        v-for="group in menuGroups"
        :key="group.id"
        class="nav-group"
      >
        <h2 class="nav-group-title">{{ t(group.titleKey) }}</h2>
        <ul class="nav-list">
          <li v-for="item in group.items" :key="item.name">
            <a
              href="#"
              class="nav-item"
              :class="{ active: isActive(item.name) }"
              :aria-current="isActive(item.name) ? 'page' : undefined"
              @click.prevent="onSelect(item.name)"
            >
              <span class="nav-icon" :data-icon="item.icon">
                <MenuIcon :name="item.icon" />
              </span>
              <span class="nav-label">{{ t(item.titleKey) }}</span>
            </a>
          </li>
        </ul>
      </section>
    </nav>

    <div class="sider-footer">
      <LanguageSwitch />
      <div class="esptool-version" :title="esptoolVersionLabel">
        {{ esptoolVersionLabel }}
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import LanguageSwitch from "@/components/LanguageSwitch.vue";
import MenuIcon from "@/components/icons/MenuIcon.vue";
import { useAppSplash } from "@/composables/useAppSplash";
import { useMenuNavigation } from "@/composables/useMenuNavigation";
import { getMenuGroups } from "@/router/menu";
import { fetchEsptoolVersion } from "@/utils/esptoolVersion";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { navigateTo } = useMenuNavigation();
const { show: showSplash } = useAppSplash();

const esptoolVersion = ref<string | null>(null);

const menuGroups = computed(() => getMenuGroups(router));

const esptoolVersionLabel = computed(() =>
  esptoolVersion.value
    ? t("common.esptoolVersion", { version: esptoolVersion.value })
    : t("common.esptoolVersionUnknown")
);

function isActive(name: string) {
  return route.name === name;
}

function onSelect(name: string) {
  void navigateTo(name);
}

onMounted(() => {
  void fetchEsptoolVersion().then((version) => {
    esptoolVersion.value = version;
  });
});
</script>

<style scoped>
.app-sider {
  --sider-bg: #0f1115;
  --sider-border: rgba(255, 255, 255, 0.07);
  --sider-text: rgba(255, 255, 255, 0.88);
  --sider-muted: rgba(255, 255, 255, 0.42);
  --sider-hover: rgba(255, 255, 255, 0.05);
  --sider-active: rgba(56, 189, 248, 0.12);

  display: flex;
  flex-direction: column;
  width: 220px;
  height: 100vh;
  flex-shrink: 0;
  background:
    radial-gradient(120% 60% at 0% 0%, rgba(56, 189, 248, 0.08), transparent 55%),
    var(--sider-bg);
  border-right: 1px solid var(--sider-border);
  overflow: hidden;
  user-select: none;
}

.sider-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  padding: 16px 14px 14px;
  border-bottom: 1px solid var(--sider-border);
}

.brand-logo-btn {
  display: inline-flex;
  flex-shrink: 0;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  line-height: 0;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.brand-logo-btn:hover {
  transform: scale(1.04);
}

.brand-logo-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.45);
}

.brand-logo {
  width: 45px;
  height: 45px;
  border-radius: 10px;
  object-fit: cover;
  display: block;
}

.brand-text {
  min-width: 0;
}

.brand-name {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1.25;
  color: var(--sider-text);
}

.brand-tagline {
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.3;
  color: var(--sider-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sider-nav {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 10px 10px 12px;
}

.nav-group + .nav-group {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.nav-group-title {
  margin: 0 0 6px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--sider-muted);
  line-height: 1.4;
}

.nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin: 0;
  padding: 8px 8px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  text-align: left;
  text-decoration: none;
  box-sizing: border-box;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.nav-item:hover {
  background: var(--sider-hover);
  color: var(--sider-text);
}

.nav-item:focus-visible {
  outline: none;
  border-color: rgba(56, 189, 248, 0.45);
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.18);
}

.nav-item.active {
  background: var(--sider-active);
  border-color: rgba(56, 189, 248, 0.22);
  color: #e0f2fe;
  box-shadow: inset 2px 0 0 #38bdf8;
}

.nav-icon {
  --icon-tint: rgba(255, 255, 255, 0.06);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 7px;
  background: var(--icon-tint);
  font-size: 15px;
  transition: filter 0.15s ease, box-shadow 0.15s ease;
}

.nav-icon[data-icon="flash"] { --icon-tint: rgba(250, 173, 20, 0.14); }
.nav-icon[data-icon="firmware"] { --icon-tint: rgba(54, 207, 201, 0.14); }
.nav-icon[data-icon="partition"] { --icon-tint: rgba(105, 177, 255, 0.14); }
.nav-icon[data-icon="ota"] { --icon-tint: rgba(64, 169, 255, 0.14); }
.nav-icon[data-icon="nvs"] { --icon-tint: rgba(255, 197, 61, 0.14); }
.nav-icon[data-icon="ble"] { --icon-tint: rgba(64, 150, 255, 0.14); }
.nav-icon[data-icon="pinout"] { --icon-tint: rgba(149, 222, 100, 0.14); }
.nav-icon[data-icon="image"] { --icon-tint: rgba(255, 133, 192, 0.14); }

.nav-item:hover .nav-icon {
  filter: brightness(1.12);
}

.nav-item.active .nav-icon {
  filter: brightness(1.2);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.nav-label {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sider-footer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border-top: 1px solid var(--sider-border);
  background: rgba(0, 0, 0, 0.18);
}

.esptool-version {
  font-size: 11px;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.35);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
