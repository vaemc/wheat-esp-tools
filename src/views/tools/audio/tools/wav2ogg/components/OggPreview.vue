<template>
  <div class="ogg-preview">
    <div class="preview-stage">
      <div v-if="!hasSource" class="preview-empty">
        {{ emptyText }}
      </div>
      <template v-else>
        <div class="wave-stage" aria-hidden="true">
          <span
            v-for="(h, idx) in bars"
            :key="idx"
            class="wave-bar"
            :class="{ active: playing }"
            :style="{ height: `${h}%`, animationDelay: `${idx * 40}ms` }"
          />
        </div>
        <div class="stage-name" :title="fileName">{{ fileName }}</div>
      </template>
    </div>

    <div v-if="hasSource" class="preview-meta">
      <span v-if="codecLabel" class="meta-with-tip">
        {{ codecLabel }}
        <a-tooltip>
          <template #title>
            <div>{{ $t("audio.codecHint") }}</div>
            <div>{{ $t("audio.codecHintMore") }}</div>
          </template>
          <span class="tip-icon">?</span>
        </a-tooltip>
      </span>
      <span v-if="sampleRate" class="meta-with-tip">
        {{ sampleRate }} Hz
        <a-tooltip :title="$t('audio.sampleRateHint')">
          <span class="tip-icon">?</span>
        </a-tooltip>
      </span>
      <span v-if="bitDepth">{{ bitDepth }} bit</span>
      <span v-if="channels">{{ channels }}ch</span>
      <span v-if="bitrateText" class="meta-with-tip">
        {{ bitrateText }}
        <a-tooltip :title="$t('audio.bitrateHint')">
          <span class="tip-icon">?</span>
        </a-tooltip>
      </span>
      <span v-if="hasComplexity">Q {{ complexity }}</span>
      <span>{{ formatDuration(duration) }}</span>
      <span v-if="byteLength">{{ formatBytes(byteLength) }}</span>
    </div>

    <div v-if="hasSource" class="preview-controls">
      <a-button size="small" @click="togglePlay">
        {{ playing ? pauseLabel : playLabel }}
      </a-button>
      <a-checkbox v-model:checked="loop">
        {{ loopLabel }}
      </a-checkbox>
      <span class="time-label">
        {{ formatDuration(currentTime) }} / {{ formatDuration(duration) }}
      </span>
    </div>

    <div v-if="hasSource" class="preview-seek">
      <a-slider
        :value="seekPercent"
        :min="0"
        :max="1000"
        :tip-formatter="formatSeekTip"
        @change="onSeek"
      />
    </div>

    <audio
      ref="audioRef"
      class="hidden-audio"
      preload="metadata"
      :src="src || undefined"
      @loadedmetadata="onMeta"
      @timeupdate="onTimeUpdate"
      @ended="onEnded"
      @play="playing = true"
      @pause="playing = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import prettyBytes from "pretty-bytes";
import { formatDuration } from "@/utils/audio/formatDuration";
import type { OggCodec } from "@/utils/audio/ogg/types";

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    src: string | null;
    fileName?: string;
    codec?: OggCodec | "";
    sampleRate?: number;
    channels?: number;
    bitDepth?: number;
    bitrateKbps?: number;
    /** Opus complexity 0–10；未知为 -1 */
    complexity?: number;
    byteLength?: number;
    emptyText?: string;
    playLabel?: string;
    pauseLabel?: string;
    loopLabel?: string;
    autoPlay?: boolean;
  }>(),
  {
    fileName: "",
    codec: "",
    sampleRate: 0,
    channels: 0,
    bitDepth: 0,
    bitrateKbps: 0,
    complexity: -1,
    byteLength: 0,
    emptyText: "No preview",
    playLabel: "Play",
    pauseLabel: "Pause",
    loopLabel: "Loop",
    autoPlay: true,
  }
);

const audioRef = ref<HTMLAudioElement | null>(null);
const playing = ref(false);
const loop = ref(true);
const currentTime = ref(0);
const duration = ref(0);
const bars = [28, 52, 38, 72, 44, 66, 36, 80, 48, 60, 42, 70, 34, 58, 46, 64];

const hasSource = computed(() => Boolean(props.src));
const hasComplexity = computed(() => (props.complexity ?? -1) >= 0);
const codecLabel = computed(() => {
  if (props.codec === "opus") {
    return t("audio.codecOpus");
  }
  if (props.codec === "vorbis") {
    return t("audio.codecVorbis");
  }
  if (props.codec === "flac") {
    return t("audio.codecFlac");
  }
  return "";
});
const seekPercent = computed(() => {
  if (!duration.value) {
    return 0;
  }
  return Math.round((currentTime.value / duration.value) * 1000);
});

/**
 * 优先显示转换时的目标码率。
 * 外部打开的文件通常不带目标码率元数据，只能用「体积/时长」估算；
 * 其中包含 Ogg 页头开销，短音频会明显高于真实 Opus 载荷码率（如 16→~20、32→~36）。
 */
const bitrateText = computed(() => {
  const target = props.bitrateKbps > 0 ? Math.round(props.bitrateKbps) : 0;
  if (target > 0) {
    return `${target} kbps`;
  }
  if (props.byteLength > 0 && duration.value > 0.05) {
    const estimated = Math.max(
      1,
      Math.round((props.byteLength * 8) / duration.value / 1000)
    );
    return `~${estimated} kbps`;
  }
  return "";
});

function formatBytes(n: number) {
  return prettyBytes(n);
}

function formatSeekTip(v?: number) {
  if (!duration.value || v == null) {
    return "0:00.00";
  }
  return formatDuration((v / 1000) * duration.value);
}

function onMeta() {
  const el = audioRef.value;
  if (!el) {
    return;
  }
  duration.value = Number.isFinite(el.duration) ? el.duration : 0;
}

function onTimeUpdate() {
  const el = audioRef.value;
  if (!el) {
    return;
  }
  currentTime.value = el.currentTime;
}

function onEnded() {
  if (loop.value && audioRef.value) {
    audioRef.value.currentTime = 0;
    void audioRef.value.play();
    return;
  }
  playing.value = false;
}

function togglePlay() {
  const el = audioRef.value;
  if (!el || !props.src) {
    return;
  }
  if (playing.value) {
    el.pause();
  } else {
    void el.play();
  }
}

function onSeek(value: number) {
  const el = audioRef.value;
  if (!el || !duration.value) {
    return;
  }
  el.currentTime = (value / 1000) * duration.value;
  currentTime.value = el.currentTime;
}

watch(
  () => props.src,
  (src, prev) => {
    currentTime.value = 0;
    duration.value = 0;
    playing.value = false;
    if (!src) {
      return;
    }
    // 新源：等 metadata 后按需自动播放
    if (src !== prev && props.autoPlay) {
      requestAnimationFrame(() => {
        const el = audioRef.value;
        if (el && props.src === src) {
          void el.play().catch(() => {
            /* 用户手势限制时忽略 */
          });
        }
      });
    }
  }
);

onBeforeUnmount(() => {
  audioRef.value?.pause();
});
</script>

<style scoped>
.ogg-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.preview-stage {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
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
  padding: 16px 12px;
}

.preview-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.38);
}

.wave-stage {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 4px;
  width: min(360px, 80%);
  height: 100px;
  max-height: 280px;
}

.wave-bar {
  flex: 1;
  min-width: 3px;
  max-width: 8px;
  border-radius: 2px;
  background: linear-gradient(
    180deg,
    rgba(54, 207, 201, 0.95),
    rgba(56, 189, 248, 0.35)
  );
  transform-origin: bottom;
}

.wave-bar.active {
  animation: pulse 0.9s ease-in-out infinite alternate;
}

@keyframes pulse {
  from {
    transform: scaleY(0.55);
    opacity: 0.7;
  }
  to {
    transform: scaleY(1);
    opacity: 1;
  }
}

.stage-name {
  max-width: 90%;
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.82);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.meta-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tip-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.28);
  font-size: 9px;
  line-height: 1;
  color: rgba(255, 255, 255, 0.45);
  cursor: help;
}

.preview-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-label {
  margin-left: auto;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
}

.preview-seek {
  padding: 0 4px;
}

.hidden-audio {
  display: none;
}
</style>
