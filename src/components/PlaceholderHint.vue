<template>
  <p class="placeholder-hint">{{ text }}</p>
</template>
<script setup lang="ts">
defineProps<{
  text: string;
}>();
</script>
