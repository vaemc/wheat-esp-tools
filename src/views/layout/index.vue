<template>
  <a-layout>
    <a-layout-sider
      style="height: 100vh"
      collapsed-width="0"
    >
      <div class="sider-inner">
        <a-menu
          v-model:selectedKeys="selectedKeys"
          theme="dark"
          mode="inline"
          @click="onMenuClick"
        >
          <a-menu-item v-for="item in menuRoutes" :key="item.name">
            <span class="menu-item-content">
              <span class="menu-icon" aria-hidden="true">{{ item.icon }}</span>
              <span class="menu-title">{{ t(item.titleKey) }}</span>
            </span>
          </a-menu-item>
        </a-menu>
        <div class="sider-footer">
          <LanguageSwitch />
        </div>
      </div>
    </a-layout-sider>
    <a-layout class="main-layout">
      <a-layout-header class="app-device-header">
        <DeviceTopBar />
      </a-layout-header>
      <a-layout-content class="app-main-content">
        <router-view />
      </a-layout-content>
      <Terminal />
    </a-layout>
  </a-layout>
</template>
<script setup lang="ts">
import Terminal from "@/components/Terminal.vue";
import DeviceTopBar from "@/components/DeviceTopBar.vue";
import LanguageSwitch from "@/components/LanguageSwitch.vue";
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useToolsStore } from "@/stores/Tool";
import { getMenuItems } from "@/router/menu";
import type { MenuProps } from "ant-design-vue";

const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const store = useToolsStore();
const { selectedKeys } = storeToRefs(store);

const menuRoutes = computed(() => getMenuItems(router));

watch(
  () => route.name,
  (name) => {
    if (name) {
      selectedKeys.value = [name];
    }
  },
  { immediate: true }
);

const onMenuClick: MenuProps["onClick"] = ({ key }) => {
  router.push({ name: String(key) });
};
</script>
<style scoped>
.sider-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.sider-footer {
  margin-top: auto;
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.menu-item-content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.menu-icon {
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}
.main-layout {
  min-height: 100vh;
  background: #141414;
}
.app-device-header {
  height: auto;
  line-height: 1.5;
  padding: 0;
  background: transparent;
}
.app-main-content {
  min-height: 280px;
  padding: 0;
  background: #141414;
}
</style>
