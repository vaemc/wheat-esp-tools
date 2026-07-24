import type { Router } from "vue-router";
import type { MenuGroup, MenuGroupId, MenuItem } from "./types";

const GROUP_ORDER: MenuGroupId[] = [
  "flash",
  "hardware",
  "utils",
  "companion",
  "system",
];

const GROUP_TITLE_KEYS: Record<MenuGroupId, string> = {
  flash: "menu.group.flash",
  hardware: "menu.group.hardware",
  utils: "menu.group.utils",
  companion: "menu.group.companion",
  system: "menu.group.system",
};

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
      group: route.meta.menuGroup ?? "utils",
    }))
    .sort((a, b) => a.order - b.order);
}

/** 按功能分组的侧栏菜单 */
export function getMenuGroups(router: Router): MenuGroup[] {
  const items = getMenuItems(router);
  return GROUP_ORDER.map((id) => ({
    id,
    titleKey: GROUP_TITLE_KEYS[id],
    items: items.filter((item) => item.group === id),
  })).filter((group) => group.items.length > 0);
}
