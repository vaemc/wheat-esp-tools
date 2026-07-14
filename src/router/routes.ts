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
      icon: "flash",
      titleKey: "menu.flash",
      menu: true,
      menuOrder: 1,
    },
  },
  {
    path: "tools/firmware",
    name: "firmware",
    component: () => import("@/views/tools/firmware/index.vue"),
    meta: {
      icon: "firmware",
      titleKey: "menu.firmware",
      menu: true,
      menuOrder: 2,
    },
  },
  {
    path: "tools/partition",
    name: "partition",
    component: () => import("@/views/tools/partition/index.vue"),
    meta: {
      icon: "partition",
      titleKey: "menu.partitionTable",
      menu: true,
      menuOrder: 3,
    },
  },
  {
    path: "tools/ota",
    name: "ota",
    component: () => import("@/views/tools/ota/index.vue"),
    meta: {
      icon: "ota",
      titleKey: "menu.ota",
      menu: true,
      menuOrder: 4,
    },
  },
  {
    path: "tools/nvs",
    name: "nvs",
    component: () => import("@/views/tools/nvs/index.vue"),
    meta: {
      icon: "nvs",
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
      icon: "ble",
      titleKey: "menu.ble",
      menu: true,
      menuOrder: 6,
    },
  },
  {
    path: "tools/pinout",
    name: "pinout",
    component: () => import("@/views/tools/pinout/index.vue"),
    meta: {
      icon: "pinout",
      titleKey: "menu.pinout",
      menu: true,
      menuOrder: 7,
    },
  },
  {
    path: "tools/image",
    name: "image",
    component: () => import("@/views/tools/image/index.vue"),
    meta: {
      icon: "image",
      titleKey: "menu.image",
      menu: true,
      menuOrder: 8,
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
