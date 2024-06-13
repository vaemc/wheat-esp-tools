import { createRouter, createWebHistory } from "vue-router";
import Layout from "@/views/layout/index.vue";
import i18n from "@/locales/i18n";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: Layout,
      children: [
        {
          path: "/",
          name: "tools",
          meta: {
            icon: "🛠️",
            title: i18n.global.t("menu.toolList"),
          },
          children: [
            {
              path: "/",
              name: "home",
              component: () => import("@/views/home/index.vue"),
              meta: {
                icon: "🐯",
                title: i18n.global.t("menu.home"),
                display: false,
              },
            },
            {
              path: "/tools/basic",
              name: "basic",
              component: () => import("@/views/tools/basic/index.vue"),
              meta: {
                icon: "🐼",
                title: i18n.global.t("menu.general"),
                display: true,
              },
            },
            {
              path: "/tools/flash",
              name: "flash",
              component: () => import("@/views/tools/flash/index.vue"),
              meta: {
                icon: "🐶",
                title: i18n.global.t("menu.flash"),
                display: true,
              },
            },
            {
              path: "/tools/partition",
              name: "partition",
              component: () => import("@/views/tools/partition/index.vue"),
              meta: {
                icon: "🐱",
                title: i18n.global.t("menu.partitionTable"),
                display: true,
              },
            },
            {
              path: "/tools/ble",
              name: "ble",
              component: () => import("@/views/tools/ble/index.vue"),
              meta: {
                icon: "🐳",
                title: "BLE",
                display: true,
              },
            },
            {
              path: "/tools/firmware",
              name: "firmware",
              component: () => import("@/views/tools/firmware/index.vue"),
              meta: {
                icon: "🐰",
                title: i18n.global.t("menu.firmware"),
                display: true,
              },
            },
          ],
        },
        {
          path: "/setting",
          name: "setting",
          meta: {
            icon: "⚙️",
            title: "设置",
            display: false,
          },
          component: () => import("@/views/setting/index.vue"),
        },
        {
          path: "/help",
          name: "help",
          meta: {
            icon: "📙",
            title: "帮助",
            display: false,
          },
          component: () => import("@/views/help/index.vue"),
        },
      ],
    },
  ],
});

export default router;
