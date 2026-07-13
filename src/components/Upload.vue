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
      <div class="up-zone__icon">
        <CloudUploadOutlined />
      </div>

      <div class="up-zone__title">{{ title }}</div>

      <div
        v-if="subtitle"
        class="up-zone__subtitle"
        v-html="subtitle"
      />

      <div class="up-zone__hint">
        <span class="up-zone__chip">
          <FolderOpenOutlined />
          <span>{{ isDirectory ? hintDir : hintFile }}</span>
        </span>
        <span v-if="isMultiple" class="up-zone__chip up-zone__chip--accent">
          <AppstoreAddOutlined />
          <span>{{ hintMultiple }}</span>
        </span>
      </div>
    </div>

    <transition name="up-fade">
      <div v-if="dragging" class="up-zone__overlay">
        <div class="up-zone__overlay-inner">
          <CloudUploadOutlined class="up-zone__overlay-icon" />
          <span>{{ dropHere }}</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  CloudUploadOutlined,
  FolderOpenOutlined,
  AppstoreAddOutlined,
} from "@ant-design/icons-vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/api/dialog";
import { useI18n } from "vue-i18n";

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

const unlisteners: UnlistenFn[] = [];

const safeListen = async (
  event: string,
  handler: (e: { payload: unknown }) => void,
) => {
  try {
    const off = await listen(event, handler as never);
    unlisteners.push(off);
  } catch (err) {
    console.warn(`[Upload] listen "${event}" failed:`, err);
  }
};

onMounted(() => {
  void safeListen("tauri://file-drop", (event) => {
    dragging.value = false;
    const payload = event.payload as string[] | string | undefined;
    if (Array.isArray(payload)) {
      if (payload.length === 1 && !props.isMultiple) {
        emit("drop", payload[0]);
      } else {
        emit("drop", payload);
      }
    } else if (typeof payload === "string") {
      emit("drop", payload);
    }
  });

  void safeListen("tauri://file-drop-hover", () => {
    dragging.value = true;
  });

  void safeListen("tauri://file-drop-cancelled", () => {
    dragging.value = false;
  });
});

onBeforeUnmount(() => {
  for (const off of unlisteners) {
    try {
      off();
    } catch {
      /* noop */
    }
  }
  unlisteners.length = 0;
});
</script>

<style scoped>
.up-zone {
  position: relative;
  width: 100%;
  min-height: 148px;
  border-radius: 10px;
  padding: 20px 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  outline: none;
  user-select: none;
  isolation: isolate;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
  border: 1px dashed rgba(148, 163, 184, 0.32);
  background: rgba(255, 255, 255, 0.015);
}

.up-zone:focus-visible {
  border-color: rgba(56, 189, 248, 0.55);
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.12);
}

.up-zone.is-hover {
  border-color: rgba(148, 163, 184, 0.55);
  background: rgba(255, 255, 255, 0.03);
}

.up-zone.is-drag {
  border-style: solid;
  border-color: rgba(56, 189, 248, 0.55);
  background: rgba(56, 189, 248, 0.06);
}

.up-zone__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 4px 0;
}

.up-zone__icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: rgba(125, 211, 252, 0.85);
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.18);
  transition: color 0.2s ease;
}

.up-zone.is-drag .up-zone__icon {
  color: #7dd3fc;
}

.up-zone__title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  letter-spacing: 0.02em;
}

.up-zone__subtitle {
  font-size: 12px;
  line-height: 1.6;
  color: rgba(203, 213, 225, 0.7);
  max-width: 640px;
}

.up-zone__subtitle :deep(b) {
  color: #93c5fd;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.up-zone__hint {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 8px;
  margin-top: 6px;
}

.up-zone__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.1);
  color: rgba(203, 213, 225, 0.85);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.up-zone__chip--accent {
  background: rgba(56, 189, 248, 0.12);
  color: #93c5fd;
  border-color: rgba(56, 189, 248, 0.3);
}

.up-zone__overlay {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  background: rgba(15, 23, 42, 0.32);
}

.up-zone__overlay-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(240, 249, 255, 0.92);
  letter-spacing: 0.02em;
}

.up-zone__overlay-icon {
  font-size: 26px;
  color: #7dd3fc;
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
