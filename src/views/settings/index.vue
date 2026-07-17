<template>
  <div class="settings-page">
    <header class="settings-hero">
      <img class="hero-logo" src="/logo.png" alt="" />
      <h1 class="hero-name">{{ $t("menu.appName") }}</h1>
      <p class="hero-tagline">{{ $t("menu.appTagline") }}</p>
      <p v-if="appVersion" class="hero-version">v{{ appVersion }}</p>
    </header>

    <section class="settings-list panel">
      <header class="panel-head">
        <span class="panel-title">{{ $t("settings.sectionGeneral") }}</span>
      </header>
      <div class="item-stack">
        <component
          :is="item.component"
          v-for="item in SETTINGS_ITEMS"
          :key="item.id"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getVersion } from "@tauri-apps/api/app";
import { SETTINGS_ITEMS } from "./registry";

const appVersion = ref("");

onMounted(async () => {
  try {
    appVersion.value = await getVersion();
  } catch {
    appVersion.value = "";
  }
});
</script>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
  padding: 20px 16px 16px;
  box-sizing: border-box;
  overflow: auto;
}

.settings-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 28px 16px 20px;
}

.hero-logo {
  width: 140px;
  height: 140px;
  border-radius: 28px;
  object-fit: cover;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.hero-name {
  margin: 14px 0 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: rgba(255, 255, 255, 0.92);
  line-height: 1.3;
}

.hero-tagline {
  margin: 6px 0 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.4;
}

.hero-version {
  margin: 8px 0 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.32);
}

.panel {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 14px;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.panel-head {
  margin-bottom: 12px;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.62);
  letter-spacing: 0.04em;
}

.item-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
