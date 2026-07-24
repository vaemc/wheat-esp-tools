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
      menuGroup: "flash",
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
      menuGroup: "flash",
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
      menuGroup: "flash",
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
      menuGroup: "flash",
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
      menuGroup: "flash",
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
      menuGroup: "hardware",
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
      menuGroup: "hardware",
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
      menuGroup: "utils",
      menuOrder: 8,
    },
  },
  {
    path: "tools/audio",
    name: "audio",
    component: () => import("@/views/tools/audio/index.vue"),
    meta: {
      icon: "audio",
      titleKey: "menu.audio",
      menu: true,
      menuGroup: "utils",
      menuOrder: 9,
    },
  },
  {
    path: "tools/font",
    name: "font",
    component: () => import("@/views/tools/font/index.vue"),
    meta: {
      icon: "font",
      titleKey: "menu.font",
      menu: true,
      menuGroup: "utils",
      menuOrder: 10,
    },
  },
  {
    path: "tools/file",
    name: "file",
    component: () => import("@/views/tools/file/index.vue"),
    meta: {
      icon: "file",
      titleKey: "menu.file",
      menu: true,
      menuGroup: "utils",
      menuOrder: 11,
    },
  },
  {
    path: "pet",
    name: "pet",
    component: () => import("@/views/pet/index.vue"),
    meta: {
      icon: "pet",
      titleKey: "menu.pet",
      menu: true,
      menuGroup: "companion",
      menuOrder: 50,
    },
  },
  {
    path: "settings",
    name: "settings",
    component: () => import("@/views/settings/index.vue"),
    meta: {
      icon: "settings",
      titleKey: "menu.settings",
      menu: true,
      menuGroup: "system",
      menuOrder: 100,
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
