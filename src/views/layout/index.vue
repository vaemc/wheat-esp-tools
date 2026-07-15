<template>
  <div class="app-root">
    <AppSider />
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
  </div>
</template>
<script setup lang="ts">
import Terminal from "@/components/Terminal.vue";
import DeviceTopBar from "@/components/DeviceTopBar.vue";
import AppSider from "./AppSider.vue";
</script>
<style scoped>
.app-root {
  display: flex;
  flex-direction: row;
  height: 100vh;
  overflow: hidden;
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
