<template>
  <div
    class="source-wrap"
    :class="{ empty: !font, dragging: isDragging }"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div v-if="!font" class="source-empty" @click="emit('pick')">
      <FontSizeOutlined class="empty-icon" />
      <div class="empty-text">
        <p class="empty-title">{{ $t("font.dropTitle") }}</p>
        <p class="empty-hint">{{ $t("font.dropHint") }}</p>
      </div>
    </div>

    <div v-else class="source-card">
      <div class="source-thumb">
        <span
          class="thumb-glyph"
          :style="{ fontFamily: `'${font.familyName}', sans-serif` }"
        >
          Ag
        </span>
        <span v-if="font.status === 'converting'" class="card-badge">
          <LoadingOutlined spin />
        </span>
        <span
          v-else-if="font.status === 'done'"
          class="card-badge card-badge--ok"
        >
          <CheckOutlined />
        </span>
        <span
          v-else-if="font.status === 'error'"
          class="card-badge card-badge--err"
        >
          !
        </span>
      </div>
      <div class="source-body">
        <div class="source-name" :title="font.fileName">{{ font.fileName }}</div>
        <div class="source-meta">
          {{ formatBytes(font.byteLength) }}
          <template v-if="font.sourcePath"> · {{ font.sourcePath }}</template>
        </div>
      </div>
      <div class="source-actions">
        <a-button size="small" @click="emit('pick')">
          {{ $t("font.changeFont") }}
        </a-button>
        <a-button size="small" danger @click="emit('clear')">
          {{ $t("font.clearFont") }}
        </a-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  CheckOutlined,
  FontSizeOutlined,
  LoadingOutlined,
} from "@ant-design/icons-vue";
import prettyBytes from "pretty-bytes";
import type { CurrentFont } from "../../tools/lvglfont/composables/useLvglFont";

defineProps<{
  font: CurrentFont | null;
}>();

const emit = defineEmits<{
  pick: [];
  clear: [];
  "drop-files": [files: FileList | File[]];
}>();

const isDragging = ref(false);
let dragDepth = 0;

function formatBytes(n: number) {
  return prettyBytes(n);
}

function onDragEnter() {
  dragDepth += 1;
  isDragging.value = true;
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) {
    isDragging.value = false;
  }
}

function onDrop(event: DragEvent) {
  dragDepth = 0;
  isDragging.value = false;
  const files = event.dataTransfer?.files;
  if (files?.length) {
    emit("drop-files", files);
  }
}
</script>

<style scoped>
.source-wrap {
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.16);
  overflow: hidden;
}

.source-wrap.dragging {
  border-color: rgba(250, 173, 20, 0.55);
  background: rgba(250, 173, 20, 0.06);
}

.source-wrap.empty {
  cursor: pointer;
}

.source-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 18px 16px;
  color: rgba(255, 255, 255, 0.55);
}

.empty-icon {
  font-size: 28px;
  color: #faad14;
  flex-shrink: 0;
}

.empty-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.empty-title {
  margin: 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
}

.empty-hint {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.source-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
}

.source-thumb {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 8px;
  background: rgba(250, 173, 20, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.thumb-glyph {
  font-size: 24px;
  line-height: 1;
  color: rgba(255, 255, 255, 0.92);
}

.card-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
}

.card-badge--ok {
  background: rgba(82, 196, 26, 0.85);
}

.card-badge--err {
  background: rgba(255, 77, 79, 0.9);
  font-weight: 700;
}

.source-body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.source-name {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-meta {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
