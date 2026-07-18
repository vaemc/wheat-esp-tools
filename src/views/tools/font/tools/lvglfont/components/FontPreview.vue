<template>
  <div class="font-preview">
    <div v-if="!familyName" class="preview-empty">
      {{ emptyText }}
    </div>
    <template v-else>
      <div v-if="fileName" class="preview-meta">
        <span class="meta-name" :title="fileName">{{ fileName }}</span>
        <span v-if="byteLength" class="meta-size">{{ formatBytes(byteLength) }}</span>
      </div>
      <div
        class="preview-sample"
        :style="{
          fontFamily: `'${familyName}', sans-serif`,
          fontSize: `${previewSize}px`,
        }"
      >
        {{ sampleText || "AaBbCc 0123" }}
      </div>
      <div
        class="preview-alphabet"
        :style="{ fontFamily: `'${familyName}', sans-serif` }"
      >
        ABCDEFGHIJKLMNOPQRSTUVWXYZ
        <br />
        abcdefghijklmnopqrstuvwxyz
        <br />
        0123456789 .,;:!?#@
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import prettyBytes from "pretty-bytes";

withDefaults(
  defineProps<{
    familyName: string | null;
    fileName?: string;
    byteLength?: number;
    sampleText?: string;
    previewSize?: number;
    emptyText: string;
  }>(),
  {
    previewSize: 28,
  }
);

function formatBytes(n: number) {
  return prettyBytes(n);
}
</script>

<style scoped>
.font-preview {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.38);
  text-align: center;
  padding: 12px;
}

.preview-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}

.meta-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.preview-sample {
  padding: 16px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.92);
  line-height: 1.45;
  word-break: break-word;
  min-height: 72px;
}

.preview-alphabet {
  font-size: 13px;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.7);
  word-break: break-all;
}
</style>
