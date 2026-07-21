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
      <p class="empty-title">{{ dropTitle || $t("image.dropTitle") }}</p>
      <p class="empty-hint">{{ dropHint || $t("image.dropHint") }}</p>
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
            converting:
              item.status === 'converting' || item.status === 'loading',
          }"
          @click="emit('select', item.id)"
        >
          <div class="card-thumb">
            <img
              :src="item.objectUrl"
              :alt="item.fileName"
              draggable="false"
              loading="lazy"
              decoding="async"
            />
            <span
              v-if="item.status === 'converting' || item.status === 'loading'"
              class="card-badge"
            >
              <LoadingOutlined spin />
            </span>
            <span v-else-if="item.status === 'done'" class="card-badge card-badge--ok">
              <CheckOutlined />
            </span>
            <span v-else-if="item.status === 'error'" class="card-badge card-badge--err">
              !
            </span>
            <div
              v-if="item.status === 'converting' && typeof item.progress === 'number'"
              class="card-progress"
            >
              <div class="card-progress-bar" :style="{ width: `${item.progress}%` }" />
              <span class="card-progress-text">{{ item.progress }}%</span>
            </div>
          </div>
          <div class="card-body">
            <div class="card-name" :title="item.fileName">{{ item.fileName }}</div>
            <div class="card-meta">
              <template v-if="item.status === 'loading'">
                {{ item.progressMessage || "…" }}
              </template>
              <template v-else>
                {{ item.naturalWidth }} × {{ item.naturalHeight }}
                <template v-if="item.frameCount">
                  · {{ item.frameCount }}f
                </template>
                <template v-if="item.durationSec && item.durationSec > 0">
                  · {{ formatDurationSec(item.durationSec) }}
                </template>
                <template v-if="item.fpsEstimate && item.fpsEstimate > 0">
                  · {{ item.fpsEstimate.toFixed(1) }}fps
                </template>
                <template v-if="item.result">
                  · {{ formatBytes(item.result.bytes.length) }}
                </template>
              </template>
            </div>
            <div
              v-if="
                (item.status === 'converting' || item.status === 'loading') &&
                item.progressMessage
              "
              class="card-progress-msg"
            >
              {{ item.progressMessage }}
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
import { formatDurationSec } from "@/utils/image/shared/formatDuration";

export interface ImageGridItem {
  id: string;
  fileName: string;
  objectUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  frameCount?: number;
  /** 时长（秒），可选 */
  durationSec?: number;
  /** 估算帧率，可选 */
  fpsEstimate?: number;
  progress?: number;
  progressMessage?: string;
  status: "loading" | "idle" | "converting" | "done" | "error";
  result?: { bytes: Uint8Array };
}

defineProps<{
  items: ImageGridItem[];
  selectedId: string | null;
  dropTitle?: string;
  dropHint?: string;
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
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
  width: 100%;
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
  flex: 1 1 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  grid-auto-rows: max-content;
  gap: 10px;
  padding: 12px;
  align-content: start;
  align-items: start;
}

.batch-card {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  align-self: start;
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
  width: 100%;
  aspect-ratio: 1;
  flex-shrink: 0;
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

.card-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 22px;
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
}

.card-progress-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: rgba(56, 189, 248, 0.55);
  transition: width 0.15s ease;
}

.card-progress-text {
  position: relative;
  z-index: 1;
  width: 100%;
  text-align: center;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
}

.card-progress-msg {
  margin-top: 3px;
  font-size: 10px;
  color: rgba(125, 211, 252, 0.85);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  width: 100%;
  min-height: 168px;
  align-self: start;
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
