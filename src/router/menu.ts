import type { Router } from "vue-router";
import type { MenuItem } from "./types";

/** 从已注册路由中提取侧栏菜单项 */
export function getMenuItems(router: Router): MenuItem[] {
  return router
    .getRoutes()
    .filter((route) => route.meta.menu && route.name)
    .map((route) => ({
      name: String(route.name),
      path: route.path,
      icon: route.meta.icon ?? "",
      titleKey: route.meta.titleKey ?? "",
      order: route.meta.menuOrder ?? 0,
    }))
    .sort((a, b) => a.order - b.order);
}
