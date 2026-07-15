<template>
  <a-button
    type="primary"
    size="small"
    :loading="loading"
    @click="emit('flash', path)"
  >
    {{ $t("firmware.quickFlash") }}
  </a-button>
</template>
<script setup lang="ts">
defineProps<{
  path: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  flash: [path: string];
}>();
</script>
