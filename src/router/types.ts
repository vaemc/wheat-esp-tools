import "vue-router";

export interface AppRouteMeta {
  /** 侧栏菜单图标（emoji） */
  icon?: string;
  /** i18n 标题键，如 menu.general */
  titleKey?: string;
  /** 是否在侧栏显示 */
  menu?: boolean;
  /** 侧栏排序，越小越靠前 */
  menuOrder?: number;
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
}
