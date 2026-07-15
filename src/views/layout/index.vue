<template>
  <a-layout class="app-root">
    <a-layout-sider
      class="app-sider"
      :width="200"
      collapsed-width="0"
    >
      <div class="sider-inner">
        <a-menu
          class="sider-menu"
          :selected-keys="menuSelectedKeys"
          theme="dark"
          mode="inline"
          @click="onMenuClick"
        >
          <a-menu-item v-for="item in menuRoutes" :key="item.name">
            <span class="menu-item-content">
              <MenuIcon class="menu-icon" :name="item.icon" />
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
        <div class="app-main-scroll">
          <!--
            页面切换时通过 keep-alive 缓存组件实例，保留每个页面的本地状态
            （读取的 NVS 数据、烧录列表、引脚视图筛选等都不会因切走再回来而丢失）。
            注意：之前的 :key="route.fullPath" 会让每次切换都强制重建视图，与
                  keep-alive 互斥，所以这里去掉。
          -->
          <router-view v-slot="{ Component }">
            <keep-alive :max="6">
              <component :is="Component" />
            </keep-alive>
          </router-view>
        </div>
      </a-layout-content>
      <footer class="app-terminal">
        <Terminal />
      </footer>
    </a-layout>
  </a-layout>
</template>
<script setup lang="ts">
import Terminal from "@/components/Terminal.vue";
import DeviceTopBar from "@/components/DeviceTopBar.vue";
import LanguageSwitch from "@/components/LanguageSwitch.vue";
import MenuIcon from "@/components/icons/MenuIcon.vue";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useMenuNavigation } from "@/composables/useMenuNavigation";
import { getMenuItems } from "@/router/menu";
import type { MenuProps } from "ant-design-vue";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { navigateTo } = useMenuNavigation();

const menuRoutes = computed(() => getMenuItems(router));

/** 菜单选中态仅跟随当前路由 */
const menuSelectedKeys = computed(() =>
  route.name ? [String(route.name)] : []
);

const onMenuClick: MenuProps["onClick"] = ({ key }) => {
  void navigateTo(String(key));
};
</script>
<style scoped>
.app-root {
  height: 100vh;
  overflow: hidden;
}

.app-root :deep(.app-sider) {
  height: 100vh;
  overflow: hidden;
  flex-shrink: 0;
}

.app-root :deep(.app-sider .ant-layout-sider-children) {
  height: 100%;
  overflow: hidden;
}

.sider-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.sider-menu {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  border-inline-end: none !important;
}

.sider-footer {
  flex-shrink: 0;
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
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.main-layout {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100vh;
  overflow: hidden;
  background: #141414;
}

.app-device-header {
  flex-shrink: 0;
  height: auto;
  line-height: 1.5;
  padding: 0;
  background: transparent;
}

.app-main-content {
  flex: 1;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  background: #141414;
}

.app-main-scroll {
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
}

.app-terminal {
  flex-shrink: 0;
  background: #141414;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
</style>
