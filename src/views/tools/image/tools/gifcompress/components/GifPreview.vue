<template>
  <div class="gif-preview">
    <div class="preview-stage">
      <img
        v-if="src"
        :src="src"
        class="preview-gif"
        alt=""
      />
      <div v-else class="preview-empty">{{ emptyText }}</div>
    </div>
    <div v-if="src && metaText" class="preview-meta">
      <span v-for="(part, idx) in metaParts" :key="idx">{{ part }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import prettyBytes from "pretty-bytes";
import { formatDurationSec } from "@/utils/image/shared/formatDuration";

const props = withDefaults(
  defineProps<{
    src: string | null;
    emptyText?: string;
    width?: number;
    height?: number;
    frameCount?: number;
    byteLength?: number;
    sourceByteLength?: number;
    durationSec?: number;
    fps?: number;
    framesLabel?: string;
  }>(),
  {
    emptyText: "No preview",
    width: 0,
    height: 0,
    frameCount: 0,
    byteLength: 0,
    sourceByteLength: 0,
    durationSec: 0,
    fps: 0,
    framesLabel: "frames",
  }
);

const metaParts = computed(() => {
  const parts: string[] = [];
  if (props.width && props.height) {
    parts.push(`${props.width} × ${props.height}`);
  }
  if (props.frameCount) {
    parts.push(`${props.frameCount} ${props.framesLabel}`);
  }
  if (props.durationSec > 0) {
    parts.push(formatDurationSec(props.durationSec));
  }
  if (props.fps > 0) {
    parts.push(`${props.fps.toFixed(1)} fps`);
  }
  if (props.byteLength) {
    parts.push(prettyBytes(props.byteLength));
  }
  if (props.sourceByteLength > 0 && props.byteLength > 0) {
    const ratio = (props.byteLength / props.sourceByteLength) * 100;
    parts.push(`${ratio.toFixed(0)}%`);
  }
  return parts;
});

const metaText = computed(() => metaParts.value.length > 0);
</script>

<style scoped>
.gif-preview {
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

.preview-gif {
  max-width: 100%;
  max-height: 280px;
  object-fit: contain;
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

.preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}
</style>
