<template>
  <div
    class="up-zone"
    :class="{ 'is-hover': hover, 'is-drag': dragging }"
    role="button"
    tabindex="0"
    :aria-label="title"
    @click="pick"
    @keydown.enter.prevent="pick"
    @keydown.space.prevent="pick"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <div class="up-zone__inner">
      <div class="up-zone__mark" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <!-- Lucide: upload -->
          <path d="M12 3v12" />
          <path d="m17 8-5-5-5 5" />
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        </svg>
      </div>

      <p class="up-zone__title">{{ title }}</p>

      <div
        v-if="subtitle"
        class="up-zone__subtitle"
        v-html="subtitle"
      />

      <p class="up-zone__actions">
        <span class="up-zone__action">
          <svg
            v-if="isDirectory"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <!-- Lucide: folder-open -->
            <path
              d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"
            />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <!-- Lucide: file -->
            <path
              d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"
            />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          </svg>
          {{ isDirectory ? hintDir : hintFile }}
        </span>
        <template v-if="isMultiple">
          <span class="up-zone__dot" aria-hidden="true" />
          <span class="up-zone__action">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <!-- Lucide: files -->
              <path d="M20 7h-3a2 2 0 0 1-2-2V2" />
              <path
                d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z"
              />
              <path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8" />
            </svg>
            {{ hintMultiple }}
          </span>
        </template>
      </p>
    </div>

    <transition name="up-fade">
      <div v-if="dragging" class="up-zone__overlay">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <!-- Lucide: download -->
          <path d="M12 15V3" />
          <path d="m7 10 5 5 5-5" />
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        </svg>
        <span>{{ dropHere }}</span>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { useI18n } from "vue-i18n";
import { useTauriDragDrop } from "@/composables/useTauriDragDrop";

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    isDirectory?: boolean;
    isMultiple?: boolean;
  }>(),
  {
    subtitle: "",
    isDirectory: false,
    isMultiple: false,
  },
);

const emit = defineEmits<{
  (e: "open", path: string | string[]): void;
  (e: "drop", path: string | string[]): void;
}>();

const { t } = useI18n();

const hintFile = computed(() => t("common.upload.hintFile"));
const hintDir = computed(() => t("common.upload.hintDir"));
const hintMultiple = computed(() => t("common.upload.hintMultiple"));
const dropHere = computed(() => t("common.upload.dropHere"));

const hover = ref(false);
const dragging = ref(false);

const pick = async () => {
  try {
    const selected = await open({
      directory: props.isDirectory,
      multiple: props.isMultiple,
    });
    if (selected != null) {
      emit("open", selected as string | string[]);
    }
  } catch (err) {
    console.warn("[Upload] dialog open failed:", err);
  }
};

useTauriDragDrop({
  onDrop(paths) {
    dragging.value = false;
    if (paths.length === 1 && !props.isMultiple) {
      emit("drop", paths[0]);
    } else {
      emit("drop", paths);
    }
  },
  onEnter() {
    dragging.value = true;
  },
  onLeave() {
    dragging.value = false;
  },
});
</script>

<style scoped>
.up-zone {
  --up-fg: rgba(255, 255, 255, 0.88);
  --up-muted: rgba(255, 255, 255, 0.45);
  --up-line: rgba(255, 255, 255, 0.1);
  --up-accent: rgba(250, 173, 20, 0.85);

  position: relative;
  width: 100%;
  min-height: 132px;
  padding: 22px 20px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  border: 1px dashed var(--up-line);
  background: rgba(0, 0, 0, 0.18);
  cursor: pointer;
  outline: none;
  user-select: none;
  isolation: isolate;
  transition:
    border-color 0.18s ease,
    background 0.18s ease;
}

.up-zone:focus-visible {
  border-color: rgba(250, 173, 20, 0.45);
  background: rgba(250, 173, 20, 0.04);
}

.up-zone.is-hover {
  border-color: rgba(255, 255, 255, 0.22);
  background: rgba(0, 0, 0, 0.28);
}

.up-zone.is-drag {
  border-style: solid;
  border-color: rgba(250, 173, 20, 0.55);
  background: rgba(250, 173, 20, 0.06);
}

.up-zone__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  max-width: 640px;
  width: 100%;
}

.up-zone__mark {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.55);
  transition: color 0.18s ease, transform 0.18s ease;
}

.up-zone__mark svg {
  width: 28px;
  height: 28px;
}

.up-zone.is-hover .up-zone__mark,
.up-zone.is-drag .up-zone__mark {
  color: var(--up-accent);
}

.up-zone.is-drag .up-zone__mark {
  transform: translateY(-2px);
}

.up-zone__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--up-fg);
}

.up-zone__subtitle {
  font-size: 12px;
  line-height: 1.65;
  color: var(--up-muted);
}

.up-zone__subtitle :deep(b) {
  color: rgba(255, 255, 255, 0.72);
  font-weight: 600;
}

.up-zone__actions {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1;
  color: rgba(255, 255, 255, 0.38);
}

.up-zone__action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.up-zone__action svg {
  width: 13px;
  height: 13px;
  opacity: 0.8;
}

.up-zone__dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
}

.up-zone__overlay {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  pointer-events: none;
  background: rgba(20, 20, 20, 0.72);
  color: rgba(255, 255, 255, 0.92);
  font-size: 13px;
  font-weight: 500;
}

.up-zone__overlay svg {
  width: 18px;
  height: 18px;
  color: var(--up-accent);
}

.up-fade-enter-active,
.up-fade-leave-active {
  transition: opacity 0.15s ease;
}

.up-fade-enter-from,
.up-fade-leave-to {
  opacity: 0;
}
</style>
