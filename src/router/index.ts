import { createRouter, createWebHistory } from "vue-router";
import Layout from "../views/layout/index.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: Layout,
      children: [
        {
          path: "/",
          name: "home",
          component: () => import("@/views/home/index.vue"),
        },
        {
          path: "/tools/basic",
          name: "basic",
          component: () => import("@/views/tools/basic/index.vue"),
          meta: {
            keepAlive: true,
          },
        },
        {
          path: "/tools/flash",
          name: "flash",
          component: () => import("@/views/tools/flash/index.vue"),
          meta: {
            keepAlive: true,
          },
        },
        {
          path: "/tools/partition",
          name: "partition",
          component: () => import("@/views/tools/partition/index.vue"),
          meta: {
            keepAlive: true,
          },
        },
        {
          path: "/tools/firmware",
          name: "firmware",
          component: () => import("@/views/tools/firmware/index.vue"),
          meta: {
            keepAlive: true,
          },
        },
        {
          path: "/tools/fs",
          name: "fs",
          component: () => import("@/views/tools/fs/index.vue"),
          meta: {
            keepAlive: true,
          },
        },
      ],
    },
  ],
});

export default router;
