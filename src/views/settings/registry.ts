/**
 * 设置页 → 条目注册表。
 * 新增设置项：在 items/ 下建同级目录，并在此登记即可。
 */
import type { Component } from "vue";
import { defineAsyncComponent } from "vue";

export type SettingsItemId = "cache" | "esptool" | "update" | "opensource";

export interface SettingsItemDef {
  id: SettingsItemId;
  component: Component;
}

export const SETTINGS_ITEMS: SettingsItemDef[] = [
  {
    id: "update",
    component: defineAsyncComponent(
      () => import("./items/update/CheckUpdateItem.vue")
    ),
  },
  {
    id: "cache",
    component: defineAsyncComponent(
      () => import("./items/cache/CacheItem.vue")
    ),
  },
  {
    id: "esptool",
    component: defineAsyncComponent(
      () => import("./items/esptool/EsptoolVersionItem.vue")
    ),
  },
  {
    id: "opensource",
    component: defineAsyncComponent(
      () => import("./items/opensource/OpensourceItem.vue")
    ),
  },
];
