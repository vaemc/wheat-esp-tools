import "vue-router";

/** 侧栏菜单分组：烧录固件 / 硬件连接 / 实用工具 / 桌面伙伴 / 系统 */
export type MenuGroupId =
  | "flash"
  | "hardware"
  | "utils"
  | "companion"
  | "system";

export interface AppRouteMeta {
  /** 侧栏菜单图标名（见 MenuIcon） */
  icon?: string;
  /** i18n 标题键，如 menu.general */
  titleKey?: string;
  /** 是否在侧栏显示 */
  menu?: boolean;
  /** 侧栏排序，越小越靠前 */
  menuOrder?: number;
  /** 侧栏分组 */
  menuGroup?: MenuGroupId;
}

declare module "vue-router" {
  interface RouteMeta extends AppRouteMeta {}
}

export interface MenuItem {
  name: string;
  path: string;
  icon: string;
  titleKey: string;
  order: number;
  group: MenuGroupId;
}

export interface MenuGroup {
  id: MenuGroupId;
  titleKey: string;
  items: MenuItem[];
}
