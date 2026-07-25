<template>
  <div class="signal" aria-hidden="true">
    <span
      v-for="i in 4"
      :key="i"
      class="bar"
      :class="{ on: i <= bars }"
      :style="{ height: `${6 + i * 3}px` }"
    />
  </div>
</template>
<script setup lang="ts">
defineProps<{
  bars: number;
}>();
</script>
<style scoped>
.signal {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 18px;
}
.bar {
  width: 3px;
  border-radius: 1px;
  background: rgba(255, 255, 255, 0.18);
  transition: background 0.2s ease;
}
.bar.on {
  background: var(--sig, #3ecf8e);
}
</style>
