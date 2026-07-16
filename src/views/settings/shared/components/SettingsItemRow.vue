<template>
  <div class="settings-item">
    <div class="item-main">
      <div class="item-icon" :data-tone="tone">
        <slot name="icon" />
      </div>
      <div class="item-text">
        <div class="item-title">{{ title }}</div>
        <div v-if="description" class="item-desc">{{ description }}</div>
      </div>
    </div>
    <div class="item-actions">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    description?: string;
    tone?: "default" | "cache" | "esptool" | "update" | "opensource" | "version";
  }>(),
  {
    description: "",
    tone: "default",
  }
);
</script>

<style scoped>
.settings-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.22);
}

.item-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.item-icon {
  --tone: rgba(255, 255, 255, 0.08);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 9px;
  background: var(--tone);
  font-size: 17px;
  color: rgba(255, 255, 255, 0.78);
}

.item-icon[data-tone="cache"] {
  --tone: rgba(250, 173, 20, 0.14);
  color: #faad14;
}

.item-icon[data-tone="esptool"] {
  --tone: rgba(64, 169, 255, 0.14);
  color: #40a9ff;
}

.item-icon[data-tone="update"] {
  --tone: rgba(149, 222, 100, 0.14);
  color: #95de64;
}

.item-icon[data-tone="version"] {
  --tone: rgba(105, 177, 255, 0.14);
  color: #69b1ff;
}

.item-icon[data-tone="opensource"] {
  --tone: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.82);
}

.item-text {
  min-width: 0;
}

.item-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.35;
}

.item-desc {
  margin-top: 3px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.4;
  word-break: break-all;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
</style>
