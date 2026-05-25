import type { RouteRecordRaw } from "vue-router";
import Layout from "@/views/layout/index.vue";

/** 布局下的子路由：工具页、设置、帮助等 */
export const layoutChildren: RouteRecordRaw[] = [
  {
    path: "",
    redirect: { name: "flash" },
  },
  {
    path: "tools/flash",
    name: "flash",
    component: () => import("@/views/tools/flash/index.vue"),
    meta: {
      icon: "🔥",
      titleKey: "menu.flash",
      menu: true,
      menuOrder: 1,
    },
  },
  {
    path: "tools/partition",
    name: "partition",
    component: () => import("@/views/tools/partition/index.vue"),
    meta: {
      icon: "📋",
      titleKey: "menu.partitionTable",
      menu: true,
      menuOrder: 2,
    },
  },
  {
    path: "tools/nvs",
    name: "nvs",
    component: () => import("@/views/tools/nvs/index.vue"),
    meta: {
      icon: "🗄️",
      titleKey: "menu.nvs",
      menu: true,
      menuOrder: 5,
    },
  },
  {
    path: "tools/ble",
    name: "ble",
    component: () => import("@/views/tools/ble/index.vue"),
    meta: {
      icon: "📡",
      titleKey: "menu.ble",
      menu: true,
      menuOrder: 3,
    },
  },
  {
    path: "tools/firmware",
    name: "firmware",
    component: () => import("@/views/tools/firmware/index.vue"),
    meta: {
      icon: "📦",
      titleKey: "menu.firmware",
      menu: true,
      menuOrder: 4,
    },
  },
  {
    path: "tools/pinout",
    name: "pinout",
    component: () => import("@/views/tools/pinout/index.vue"),
    meta: {
      icon: "🧩",
      titleKey: "menu.pinout",
      menu: true,
      menuOrder: 6,
    },
  },
];

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: Layout,
    children: layoutChildren,
  },
];
