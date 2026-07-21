<template>
  <div class="eaf-preview">
    <div class="preview-stage">
      <canvas
        v-show="hasFrames"
        ref="canvasRef"
        class="preview-canvas"
      />
      <div v-if="!hasFrames" class="preview-empty">
        <template v-if="loading">
          <LoadingOutlined spin class="preview-loading-icon" />
          <span>{{ loadingText || emptyText }}</span>
          <span v-if="progressText" class="preview-loading-progress">
            {{ progressText }}
          </span>
        </template>
        <template v-else>
          {{ emptyText }}
        </template>
      </div>
      <div v-else-if="loading" class="preview-loading-badge">
        <LoadingOutlined spin />
        <span>{{ progressText || loadingText }}</span>
      </div>
    </div>

    <div v-if="hasFrames" class="preview-meta">
      <span>{{ width }} × {{ height }}</span>
      <span>
        {{ frameCount
        }}{{
          expectedFrameCount > frameCount ? ` / ${expectedFrameCount}` : ""
        }}
        {{ framesLabel }}
      </span>
      <span v-if="durationSec > 0">{{ formatDurationSec(durationSec) }}</span>
      <span>{{ bitDepth }}bit</span>
    </div>

    <div v-if="hasFrames" class="preview-controls">
      <a-button size="small" :disabled="loading" @click="togglePlay">
        {{ playing ? pauseLabel : playLabel }}
      </a-button>
      <a-checkbox v-model:checked="loop" :disabled="loading">
        {{ loopLabel }}
      </a-checkbox>
      <a-slider
        v-model:value="fps"
        :min="1"
        :max="30"
        :disabled="!hasFrames || loading"
        style="flex: 1; margin: 0 8px"
      />
      <span class="fps-label">{{ fps }} FPS</span>
    </div>

    <div v-if="hasFrames" class="preview-seek">
      <a-slider
        v-model:value="frameIndex"
        :min="0"
        :max="Math.max(0, frameCount - 1)"
        :disabled="loading"
        :tip-formatter="(v: number) => `${(v ?? 0) + 1}/${frameCount}`"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { LoadingOutlined } from "@ant-design/icons-vue";
import { formatDurationSec } from "@/utils/image/shared/formatDuration";

const props = withDefaults(
  defineProps<{
    frames: HTMLCanvasElement[];
    width?: number;
    height?: number;
    bitDepth?: number;
    emptyText?: string;
    playLabel?: string;
    pauseLabel?: string;
    loopLabel?: string;
    framesLabel?: string;
    autoPlay?: boolean;
    defaultFps?: number;
    /** 时长（秒），有可靠来源时展示 */
    durationSec?: number;
    loading?: boolean;
    loadingText?: string;
    progressText?: string;
    /** 已知总帧数（渐进解码时用于展示 n / total） */
    expectedFrameCount?: number;
  }>(),
  {
    width: 0,
    height: 0,
    bitDepth: 8,
    emptyText: "No preview",
    playLabel: "Play",
    pauseLabel: "Pause",
    loopLabel: "Loop",
    framesLabel: "frames",
    autoPlay: true,
    defaultFps: 25,
    durationSec: 0,
    loading: false,
    loadingText: "",
    progressText: "",
    expectedFrameCount: 0,
  }
);

const canvasRef = ref<HTMLCanvasElement | null>(null);
const frameIndex = ref(0);
const playing = ref(false);
const loop = ref(true);
const fps = ref(props.defaultFps);
let timer: number | null = null;
let lastFirstFrame: HTMLCanvasElement | null = null;

const hasFrames = computed(() => props.frames.length > 0);
const frameCount = computed(() => props.frames.length);

watch(
  () => props.defaultFps,
  (value) => {
    if (value > 0) {
      fps.value = value;
    }
  }
);

function drawFrame(index: number) {
  const canvas = canvasRef.value;
  const src = props.frames[index];
  if (!canvas || !src) {
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  if (canvas.width !== src.width || canvas.height !== src.height) {
    canvas.width = src.width;
    canvas.height = src.height;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0);
}

function stopTimer() {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
}

function startTimer() {
  stopTimer();
  if (!hasFrames.value || props.loading) {
    return;
  }
  const interval = Math.max(16, Math.round(1000 / fps.value));
  timer = window.setInterval(() => {
    if (frameIndex.value >= frameCount.value - 1) {
      if (loop.value) {
        frameIndex.value = 0;
      } else {
        playing.value = false;
        stopTimer();
      }
    } else {
      frameIndex.value += 1;
    }
  }, interval);
}

function togglePlay() {
  if (props.loading) {
    return;
  }
  playing.value = !playing.value;
}

function showFirstFrame() {
  frameIndex.value = 0;
  drawFrame(0);
}

watch(
  () => props.frames,
  (frames) => {
    if (!frames.length) {
      lastFirstFrame = null;
      frameIndex.value = 0;
      playing.value = false;
      stopTimer();
      const canvas = canvasRef.value;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
      }
      return;
    }

    const sameSequence =
      lastFirstFrame != null && frames[0] === lastFirstFrame;

    if (props.loading) {
      // 加载中：只静态显示首帧，不播放，避免前几帧来回抖
      playing.value = false;
      stopTimer();
      if (!sameSequence) {
        lastFirstFrame = frames[0];
        showFirstFrame();
      }
      return;
    }

    if (!sameSequence) {
      lastFirstFrame = frames[0];
      showFirstFrame();
      playing.value = props.autoPlay;
    }
  },
  { immediate: true }
);

watch(
  () => props.loading,
  (loading, wasLoading) => {
    if (loading) {
      playing.value = false;
      stopTimer();
      if (props.frames.length) {
        showFirstFrame();
      }
      return;
    }

    // 加载完成：已在加载中展示首帧，直接续播即可，勿强制跳回第 0 帧（避免闪一下）
    if (wasLoading && props.frames.length && props.autoPlay) {
      playing.value = true;
    }
  }
);

watch(frameIndex, (idx) => {
  drawFrame(idx);
});

watch([playing, fps], () => {
  if (playing.value && !props.loading) {
    startTimer();
  } else {
    stopTimer();
  }
});

onBeforeUnmount(() => {
  stopTimer();
});
</script>

<style scoped>
.eaf-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.preview-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  border-radius: 8px;
  background:
    linear-gradient(45deg, rgba(255, 255, 255, 0.06) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255, 255, 255, 0.06) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.06) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.06) 75%);
  background-size: 16px 16px;
  background-position:
    0 0,
    0 8px,
    8px -8px,
    -8px 0;
  background-color: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.preview-canvas {
  max-width: 100%;
  max-height: 280px;
  image-rendering: pixelated;
}

.preview-empty {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.38);
  background: rgba(0, 0, 0, 0.28);
}

.preview-loading-icon {
  font-size: 18px;
}

.preview-loading-progress {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
}

.preview-loading-badge {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
}

.preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.preview-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fps-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  min-width: 48px;
}

.preview-seek {
  padding: 0 4px;
}
</style>
