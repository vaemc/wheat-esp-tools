<template>
  <div
    class="batch-grid-wrap"
    :class="{ empty: items.length === 0, dragging: isDragging }"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div v-if="items.length === 0" class="batch-empty" @click="emit('pick')">
      <PictureOutlined class="empty-icon" />
      <p class="empty-title">{{ $t("image.dropTitle") }}</p>
      <p class="empty-hint">{{ $t("image.dropHint") }}</p>
    </div>

    <template v-else>
      <header class="batch-head">
        <span class="batch-count">{{ $t("image.batchCount", { n: items.length }) }}</span>
        <a-space :size="8">
          <a-button size="small" @click="emit('pick')">
            {{ $t("image.addMore") }}
          </a-button>
          <a-button size="small" danger @click="emit('clear-all')">
            {{ $t("image.clearAll") }}
          </a-button>
        </a-space>
      </header>

      <div class="batch-grid">
        <article
          v-for="item in items"
          :key="item.id"
          class="batch-card"
          :class="{
            selected: item.id === selectedId,
            done: item.status === 'done',
            error: item.status === 'error',
            converting: item.status === 'converting',
          }"
          @click="emit('select', item.id)"
        >
          <div class="card-thumb">
            <img :src="item.objectUrl" :alt="item.fileName" draggable="false" />
            <span v-if="item.status === 'converting'" class="card-badge">
              <LoadingOutlined spin />
            </span>
            <span v-else-if="item.status === 'done'" class="card-badge card-badge--ok">
              <CheckOutlined />
            </span>
            <span v-else-if="item.status === 'error'" class="card-badge card-badge--err">
              !
            </span>
          </div>
          <div class="card-body">
            <div class="card-name" :title="item.fileName">{{ item.fileName }}</div>
            <div class="card-meta">
              {{ item.naturalWidth }} × {{ item.naturalHeight }}
              <template v-if="item.result">
                · {{ formatBytes(item.result.bytes.length) }}
              </template>
            </div>
          </div>
          <a-button
            type="text"
            size="small"
            class="card-remove"
            @click.stop="emit('remove', item.id)"
          >
            <CloseOutlined />
          </a-button>
        </article>

        <button type="button" class="batch-add-card" @click="emit('pick')">
          <PlusOutlined />
          <span>{{ $t("image.addMore") }}</span>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  CheckOutlined,
  CloseOutlined,
  LoadingOutlined,
  PictureOutlined,
  PlusOutlined,
} from "@ant-design/icons-vue";
import prettyBytes from "pretty-bytes";
import type { ImageBatchItem } from "../composables/useImageBatch";

defineProps<{
  items: ImageBatchItem[];
  selectedId: string | null;
}>();

const emit = defineEmits<{
  (e: "pick"): void;
  (e: "drop-files", files: FileList): void;
  (e: "select", id: string): void;
  (e: "remove", id: string): void;
  (e: "clear-all"): void;
}>();

const isDragging = ref(false);
let dragDepth = 0;

function formatBytes(size: number) {
  return prettyBytes(size);
}

function onDragEnter() {
  dragDepth += 1;
  isDragging.value = true;
}

function onDragLeave() {
  dragDepth -= 1;
  if (dragDepth <= 0) {
    dragDepth = 0;
    isDragging.value = false;
  }
}

function onDrop(event: DragEvent) {
  dragDepth = 0;
  isDragging.value = false;
  if (event.dataTransfer?.files?.length) {
    emit("drop-files", event.dataTransfer.files);
  }
}
</script>

<style scoped>
.batch-grid-wrap {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.28);
  overflow: hidden;
}

.batch-grid-wrap.empty {
  border-style: dashed;
  border-color: rgba(148, 163, 184, 0.28);
}

.batch-grid-wrap.dragging {
  border-color: rgba(56, 189, 248, 0.55);
  background: rgba(56, 189, 248, 0.06);
}

.batch-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  cursor: pointer;
}

.empty-icon {
  font-size: 36px;
  color: rgba(125, 211, 252, 0.75);
}

.empty-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.empty-hint {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  text-align: center;
}

.batch-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.22);
  flex-shrink: 0;
}

.batch-count {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.82);
}

.batch-grid {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 10px;
  padding: 12px;
  align-content: start;
}

.batch-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.32);
  overflow: hidden;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.batch-card:hover {
  border-color: rgba(125, 211, 252, 0.35);
}

.batch-card.selected {
  border-color: rgba(56, 189, 248, 0.65);
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.25);
}

.batch-card.done {
  border-color: rgba(82, 196, 26, 0.35);
}

.batch-card.error {
  border-color: rgba(255, 77, 79, 0.45);
}

.card-thumb {
  position: relative;
  aspect-ratio: 1;
  background:
    linear-gradient(45deg, rgba(255, 255, 255, 0.04) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255, 255, 255, 0.04) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.04) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.04) 75%);
  background-size: 12px 12px;
  background-position:
    0 0,
    0 6px,
    6px -6px,
    -6px 0;
}

.card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.card-badge {
  position: absolute;
  right: 6px;
  top: 6px;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;
  background: rgba(22, 119, 255, 0.85);
}

.card-badge--ok {
  background: rgba(82, 196, 26, 0.9);
}

.card-badge--err {
  background: rgba(255, 77, 79, 0.9);
  font-weight: 700;
}

.card-body {
  padding: 8px 28px 8px 8px;
  min-width: 0;
}

.card-name {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  margin-top: 2px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.45);
}

.card-remove {
  position: absolute;
  right: 2px;
  bottom: 6px;
  color: rgba(255, 255, 255, 0.45);
  width: 24px;
  height: 24px;
  padding: 0;
}

.card-remove:hover {
  color: #ff7875;
}

.batch-add-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 148px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    color 0.2s ease,
    background 0.2s ease;
}

.batch-add-card:hover {
  border-color: rgba(125, 211, 252, 0.45);
  color: #93c5fd;
  background: rgba(56, 189, 248, 0.06);
}
</style>
