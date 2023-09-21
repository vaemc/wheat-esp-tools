<template>
  <a-layout>
    <a-layout-sider
      style="height: 100vh"
      collapsed-width="0"
      @collapse="onCollapse"
      @breakpoint="onBreakpoint"
    >
      <a-menu
        :open-keys="openKeys"
        v-model:selectedKeys="selectedKeys"
        theme="dark"
        mode="inline"
      >
        <div v-for="subMenu in routerList">
          <a-sub-menu
            v-if="subMenu.hasOwnProperty('children')"
            :key="subMenu.name"
          >
            <template #title>
              <span>{{ subMenu.meta?.icon }}{{ subMenu.meta?.title }} </span>
            </template>
            <div v-for="menu in subMenu.children">
              <a-menu-item
                v-if="menu.meta?.display"
                @click="to(menu)"
                :key="menu.name"
                >{{ menu.meta?.icon }}{{ menu.meta?.title }}
              </a-menu-item>
            </div>
          </a-sub-menu>
          <a-menu-item
            @click="to(subMenu)"
            v-if="!subMenu.hasOwnProperty('children') && subMenu.meta?.display"
            :key="subMenu.name"
          >
            <span>{{ subMenu.meta?.icon }}{{ subMenu.meta?.title }}</span>
          </a-menu-item>
        </div>
      </a-menu>
    </a-layout-sider>
    <a-layout>
      <!-- <div v-if="portShow" style="margin: 10px">
        <SerialPortSelect />
      </div> -->
      <a-layout-content :style="{  minHeight: '280px' }">
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" />
          </keep-alive>
        </router-view>
        <!-- <router-view /> -->
      </a-layout-content>
      <Terminal />
    </a-layout>
  </a-layout>
</template>
<script setup lang="ts">
import Terminal from "@/components/Terminal.vue";
import SerialPortSelect from "@/components/SerialPortSelect.vue";
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
const router = useRouter();
const portShow = ref(false);
const routerList = ref(router.options.routes[0].children);
const openKeys = ref(["tools"]);
const onCollapse = (collapsed: boolean, type: string) => {
  console.log(collapsed, type);
};
const onBreakpoint = (broken: boolean) => {
  console.log(broken);
};
const selectedKeys = ref([useRoute().name]);
const to = (data: any) => {
  router.push(data.path);
  portShow.value = data.meta?.portShow;
};
</script>
