<template>
  <div
    class="source-panel"
    :class="{ empty: !font, dragging: isDragging, filled: !!font }"
  >
    <div
      class="source-main"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
      @click="onMainClick"
    >
      <template v-if="!font">
        <div class="drop-visual" aria-hidden="true">
          <span class="drop-ring">
            <FontSizeOutlined />
          </span>
        </div>
        <div class="drop-copy">
          <p class="drop-title">{{ $t("font.dropTitle") }}</p>
          <p class="drop-hint">{{ $t("font.dropHint") }}</p>
        </div>
      </template>

      <template v-else>
        <div class="font-thumb">
          <span
            class="thumb-glyph"
            :style="{ fontFamily: `'${font.familyName}', sans-serif` }"
          >
            Ag
          </span>
          <span v-if="font.status === 'converting'" class="status-dot busy">
            <LoadingOutlined spin />
          </span>
          <span v-else-if="font.status === 'done'" class="status-dot ok">
            <CheckOutlined />
          </span>
          <span v-else-if="font.status === 'error'" class="status-dot err">
            !
          </span>
        </div>
        <div class="font-info">
          <div class="font-name" :title="font.fileName">{{ font.fileName }}</div>
          <div class="font-meta">
            <span v-if="font.internalName" class="meta-chip" :title="font.internalName">
              {{ font.internalName }}
            </span>
            <span class="meta-chip">{{ formatBytes(font.byteLength) }}</span>
          </div>
          <div v-if="font.sourcePath" class="font-path" :title="font.sourcePath">
            {{ font.sourcePath }}
          </div>
        </div>
        <div class="font-actions" @click.stop>
          <a-button size="small" @click="emit('pick')">
            {{ $t("font.changeFont") }}
          </a-button>
          <a-button size="small" danger type="text" @click="emit('clear')">
            {{ $t("font.clearFont") }}
          </a-button>
        </div>
      </template>
    </div>

    <aside class="source-side" @click.stop>
      <div class="side-label">
        <HistoryOutlined />
        <span>{{ $t("font.historyTitle") }}</span>
        <span v-if="historyItems.length" class="side-count">
          {{ historyItems.length }}
        </span>
      </div>
      <a-select
        class="history-select"
        :value="font?.sourcePath ?? undefined"
        :placeholder="$t('font.historyPlaceholder')"
        :options="historyOptions"
        show-search
        option-filter-prop="label"
        :disabled="historyItems.length === 0"
        @change="onHistoryChange"
      />
      <button
        v-if="historyItems.length"
        type="button"
        class="side-clear"
        @click="historyStore.clearAll()"
      >
        {{ $t("font.historyClear") }}
      </button>
      <p v-else class="side-empty">{{ $t("font.historyEmpty") }}</p>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import {
  CheckOutlined,
  FontSizeOutlined,
  HistoryOutlined,
  LoadingOutlined,
} from "@ant-design/icons-vue";
import { formatBytes } from "@/utils/formatBytes";
import { useFontHistoryStore } from "@/stores/fontHistory";
import type { CurrentFont } from "../../tools/lvglfont/composables/useLvglFont";

const props = defineProps<{
  font: CurrentFont | null;
}>();

const emit = defineEmits<{
  pick: [];
  clear: [];
  "drop-files": [files: FileList | File[]];
}>();

const historyStore = useFontHistoryStore();
const { items: historyItems } = storeToRefs(historyStore);

const historyOptions = computed(() =>
  historyItems.value.map((item) => ({
    value: item.path,
    label: item.name,
    title: item.path,
  }))
);

const isDragging = ref(false);
let dragDepth = 0;

function onMainClick() {
  if (!props.font) {
    emit("pick");
  }
}

function onHistoryChange(path: string | undefined) {
  if (!path) {
    return;
  }
  historyStore.usePath(path);
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
.source-panel {
  --accent: #faad14;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(200px, 260px);
  min-height: 96px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(135deg, rgba(250, 173, 20, 0.05), transparent 42%),
    rgba(0, 0, 0, 0.22);
  overflow: hidden;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.source-panel.dragging {
  border-color: rgba(250, 173, 20, 0.55);
  background:
    linear-gradient(135deg, rgba(250, 173, 20, 0.12), transparent 50%),
    rgba(250, 173, 20, 0.06);
  box-shadow: 0 0 0 1px rgba(250, 173, 20, 0.2);
}

.source-main {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  padding: 14px 16px;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
}

.source-panel.empty .source-main {
  cursor: pointer;
}

.source-panel.empty .source-main:hover {
  background: rgba(255, 255, 255, 0.02);
}

.drop-visual {
  flex-shrink: 0;
}

.drop-ring {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: var(--accent);
  background: rgba(250, 173, 20, 0.12);
  border: 1px solid rgba(250, 173, 20, 0.22);
}

.drop-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.drop-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.drop-hint {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1.4;
}

.font-thumb {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background:
    radial-gradient(circle at 30% 30%, rgba(250, 173, 20, 0.22), transparent 60%),
    rgba(250, 173, 20, 0.08);
  border: 1px solid rgba(250, 173, 20, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.thumb-glyph {
  font-size: 26px;
  line-height: 1;
  color: rgba(255, 255, 255, 0.94);
}

.status-dot {
  position: absolute;
  right: -4px;
  top: -4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.status-dot.ok {
  background: rgba(82, 196, 26, 0.9);
}

.status-dot.err {
  background: rgba(255, 77, 79, 0.92);
  font-weight: 700;
}

.status-dot.busy {
  background: rgba(250, 173, 20, 0.9);
}

.font-info {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.font-name {
  font-size: 14px;
  font-weight: 560;
  color: rgba(255, 255, 255, 0.92);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.font-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.meta-chip {
  max-width: 220px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.font-path {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.32);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.font-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.source-side {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.015);
}

.side-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.62);
}

.side-count {
  margin-left: auto;
  min-width: 18px;
  padding: 0 6px;
  height: 18px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: rgba(250, 173, 20, 0.95);
  background: rgba(250, 173, 20, 0.12);
}

.history-select {
  width: 100%;
}

.side-clear {
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: none;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.38);
  cursor: pointer;
}

.side-clear:hover {
  color: #ff7875;
}

.side-empty {
  margin: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.32);
  line-height: 1.4;
}

@media (max-width: 860px) {
  .source-panel {
    grid-template-columns: 1fr;
  }

  .source-main {
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .source-side {
    padding-top: 10px;
    padding-bottom: 12px;
  }
}
</style>
