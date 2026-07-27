<template>
  <Transition name="espflash-bar">
    <div
      v-if="store.busy || store.phase === 'done' || store.phase === 'error'"
      class="espflash-progress"
      role="status"
      aria-live="polite"
    >
      <div class="espflash-progress__meta">
        <span class="espflash-progress__op">{{ opLabel }}</span>
        <span class="espflash-progress__msg" :title="store.message">
          {{ store.message || "…" }}
        </span>
        <span class="espflash-progress__pct">{{ store.percent }}%</span>
        <button
          v-if="store.busy"
          class="espflash-progress__stop"
          :disabled="stopping"
          @click="onStop"
        >
          {{ stopping ? "…" : t("espflash.stop") }}
        </button>
      </div>
      <a-progress
        :percent="store.percent"
        :status="progressStatus"
        :show-info="false"
        size="small"
        stroke-color="#3b82f6"
      />
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useEspflashStore } from "@/stores/espflash";
import { cancelEspflash } from "@/utils/espflash";

const { t } = useI18n();
const store = useEspflashStore();
const stopping = ref(false);

onMounted(() => {
  void store.bind();
});

// 新任务开始时重置停止状态
watch(
  () => store.jobId,
  () => {
    stopping.value = false;
  }
);

async function onStop() {
  stopping.value = true;
  const ok = await cancelEspflash();
  if (!ok) {
    stopping.value = false;
  }
}

const opLabel = computed(() => {
  switch (store.op) {
    case "write":
      return t("espflash.opWrite");
    case "read":
      return t("espflash.opRead");
    case "erase":
      return t("espflash.opErase");
    case "erase_region":
      return t("espflash.opEraseRegion");
    case "device_info":
      return t("espflash.opDeviceInfo");
    case "merge":
      return t("espflash.opMerge");
    default:
      return t("espflash.opGeneric");
  }
});

const progressStatus = computed(() => {
  if (store.phase === "error") {
    return "exception";
  }
  if (store.phase === "done") {
    return "success";
  }
  return "active";
});
</script>

<style scoped>
.espflash-progress {
  flex-shrink: 0;
  padding: 8px 14px 6px;
  background: linear-gradient(
    180deg,
    rgba(30, 41, 59, 0.95) 0%,
    rgba(15, 23, 42, 0.98) 100%
  );
  border-top: 1px solid rgba(59, 130, 246, 0.25);
}

.espflash-progress__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
  min-width: 0;
  font-size: 12px;
  line-height: 1.3;
  color: rgba(226, 232, 240, 0.92);
}

.espflash-progress__op {
  flex-shrink: 0;
  padding: 1px 8px;
  border-radius: 4px;
  background: rgba(59, 130, 246, 0.22);
  color: #93c5fd;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.espflash-progress__msg {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(203, 213, 225, 0.95);
}

.espflash-progress__pct {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  color: #93c5fd;
  font-weight: 600;
}

.espflash-progress__stop {
  flex-shrink: 0;
  padding: 1px 10px;
  border: 1px solid rgba(248, 113, 113, 0.45);
  border-radius: 4px;
  background: rgba(248, 113, 113, 0.12);
  color: #fca5a5;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.espflash-progress__stop:hover:not(:disabled) {
  background: rgba(248, 113, 113, 0.25);
  border-color: rgba(248, 113, 113, 0.7);
}

.espflash-progress__stop:disabled {
  opacity: 0.5;
  cursor: default;
}

.espflash-progress :deep(.ant-progress) {
  margin: 0;
  line-height: 1;
}

.espflash-progress :deep(.ant-progress-inner) {
  background: rgba(255, 255, 255, 0.08);
}

.espflash-bar-enter-active,
.espflash-bar-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.espflash-bar-enter-from,
.espflash-bar-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
