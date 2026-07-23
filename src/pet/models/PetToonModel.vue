<template>
  <!--
    灵宠：像素神话小兽（狐火精灵）
    40×40 像素格 + 分层动画（耳/尾/狐火独立），铺满父级本体框。
  -->
  <div
    class="pix"
    :data-mood="mood"
    :data-anim="animState"
    :data-wormhole="wormholePhase"
    :style="rootVars"
    aria-hidden="true"
  >
    <i v-if="showShadow" class="pix-shadow" />

    <!-- 虫洞门：独立于角色舞台，隐身/掉落时洞口仍可见 -->
    <svg
      v-if="wormholePhase === 'warp' || wormholePhase === 'in'"
      class="pix-portal-svg"
      viewBox="0 0 40 40"
      width="100%"
      height="100%"
      shape-rendering="crispEdges"
      aria-hidden="true"
    >
      <g class="pix-portal">
        <rect
          v-for="(p, i) in portalPixels"
          :key="'p' + i"
          :x="p.x"
          :y="p.y"
          width="1"
          height="1"
          :fill="p.fill"
          :opacity="p.opacity ?? 1"
        />
      </g>
    </svg>

    <div class="pix-stage">
      <svg
        class="pix-svg"
        viewBox="0 0 40 40"
        width="100%"
        height="100%"
        shape-rendering="crispEdges"
      >
        <!-- 场景道具（动作触发） -->
        <g v-if="scenePixels.length" class="pix-scene">
          <rect
            v-for="(p, i) in scenePixels"
            :key="'s' + i"
            :x="p.x"
            :y="p.y"
            width="1"
            height="1"
            :fill="p.fill"
            :opacity="p.opacity ?? 1"
          />
        </g>

        <!-- 身后灵气：呼吸光晕 + 漂浮粒子（出现/消失） -->
        <g class="pix-aura" :data-sleep="animState === 'sleep' || mood === 'sleep' ? '1' : '0'">
          <g class="pix-breath">
            <rect
              v-for="(p, i) in breathPixels"
              :key="'br' + i"
              :x="p.x"
              :y="p.y"
              width="1"
              height="1"
              :fill="p.fill"
              :opacity="p.opacity ?? 1"
            />
          </g>
          <g
            v-for="(p, i) in floatParticles"
            :key="'fp' + i"
            class="pix-particle"
            :style="{
              '--p-delay': p.delay,
              '--p-dur': p.dur,
              '--p-rise': p.rise,
              '--p-drift': p.drift,
            }"
          >
            <rect
              v-for="(c, j) in p.cells"
              :key="'c' + j"
              :x="c.x"
              :y="c.y"
              width="1"
              height="1"
              :fill="c.fill"
              :opacity="c.opacity ?? 1"
            />
          </g>
        </g>

        <!-- 光翼：身后能量翼片（左右分层漂浮） -->
        <g class="pix-wings">
          <g class="pix-wing pix-wing--l">
            <rect
              v-for="(p, i) in leftWingPixels"
              :key="'wl' + i"
              :x="p.x"
              :y="p.y"
              width="1"
              height="1"
              :fill="p.fill"
              :opacity="p.opacity ?? 1"
            />
          </g>
          <g class="pix-wing pix-wing--r">
            <rect
              v-for="(p, i) in rightWingPixels"
              :key="'wr' + i"
              :x="p.x"
              :y="p.y"
              width="1"
              height="1"
              :fill="p.fill"
              :opacity="p.opacity ?? 1"
            />
          </g>
        </g>

        <!-- 尾巴 + 狐火 -->
        <g class="pix-tail">
          <rect
            v-for="(p, i) in tailPixels"
            :key="'t' + i"
            :x="p.x"
            :y="p.y"
            width="1"
            height="1"
            :fill="p.fill"
          />
        </g>

        <!-- 身体 -->
        <g class="pix-body">
          <rect
            v-for="(p, i) in bodyPixels"
            :key="'b' + i"
            :x="p.x"
            :y="p.y"
            width="1"
            height="1"
            :fill="p.fill"
          />
        </g>

        <!-- 耳朵（可单独抖） -->
        <g class="pix-ears">
          <rect
            v-for="(p, i) in earPixels"
            :key="'a' + i"
            :x="p.x"
            :y="p.y"
            width="1"
            height="1"
            :fill="p.fill"
          />
        </g>

        <!-- 主题装饰 -->
        <g v-if="decorPixels.length" class="pix-decor">
          <rect
            v-for="(p, i) in decorPixels"
            :key="'d' + i"
            :x="p.x"
            :y="p.y"
            width="1"
            height="1"
            :fill="p.fill"
            :opacity="p.opacity ?? 1"
          />
        </g>

        <!-- 眼睛（视线跟随；眼珠限制在眼白内） -->
        <g class="pix-eyes">
          <rect x="14" y="14" width="3" height="3" fill="#fff8f0" />
          <rect x="23" y="14" width="3" height="3" fill="#fff8f0" />
          <rect
            class="eye-pupil"
            :x="14 + pupil.ox"
            :y="14 + pupil.oy"
            width="1.2"
            height="1.2"
            :fill="visual.accent"
          />
          <rect
            class="eye-pupil"
            :x="23 + pupil.ox"
            :y="14 + pupil.oy"
            width="1.2"
            height="1.2"
            :fill="visual.accent"
          />
          <rect
            :x="14.35 + pupil.ox"
            :y="14.3 + pupil.oy"
            width="0.45"
            height="0.45"
            fill="#ffffff"
            opacity="0.9"
          />
          <rect
            :x="23.35 + pupil.ox"
            :y="14.3 + pupil.oy"
            width="0.45"
            height="0.45"
            fill="#ffffff"
            opacity="0.9"
          />
        </g>

        <!-- 睡眼 -->
        <g v-if="animState === 'sleep' || mood === 'sleep'" class="pix-sleep">
          <rect x="14" y="15" width="3" height="1" fill="#2a2030" />
          <rect x="23" y="15" width="3" height="1" fill="#2a2030" />
        </g>
      </svg>

      <span v-if="animState === 'sleep' || mood === 'sleep'" class="pix-z"
        >z</span
      >
      <i
        v-else-if="
          animState === 'happy' || mood === 'happy' || mood === 'excited'
        "
        class="pix-spark"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PetIdleMotion } from "../motions";
import type { PetMood } from "../types";
import type { PetSkinVisual } from "../skins";
import type { PetToonDecorId } from "../skins/themes";
import { resolveToonAnimState } from "../toonAnim";

const props = withDefaults(
  defineProps<{
    visual: PetSkinVisual;
    mood: PetMood;
    gaze: { x: number; y: number };
    motion?: PetIdleMotion;
    decor?: PetToonDecorId | null;
    showShadow?: boolean;
    wormholePhase?: "idle" | "out" | "warp" | "in";
  }>(),
  {
    motion: "idle-float",
    decor: null,
    showShadow: true,
    wormholePhase: "idle",
  }
);

const animState = computed(() =>
  resolveToonAnimState(props.motion, props.mood)
);

/** 眼白 3×3，瞳孔 1.2；偏移钳制在眼白内缘 */
const pupil = computed(() => {
  const inset = 0.35;
  const pupilSize = 1.2;
  const max = 3 - pupilSize - inset;
  const ox = Math.min(max, Math.max(inset, inset + 0.45 + props.gaze.x * 0.28));
  const oy = Math.min(max, Math.max(inset, inset + 0.35 + props.gaze.y * 0.22));
  return { ox, oy };
});

const rootVars = computed(
  () =>
    ({
      "--pix-accent": props.visual.accent,
      "--pix-accent-soft": props.visual.accentSoft,
    }) as Record<string, string>
);

type Pix = { x: number; y: number; fill: string; opacity?: number };

/** 40×40 像素狐火精灵：更清晰轮廓 + 分层部件 */
const palette = computed(() => {
  const c = props.visual;
  return {
    fur: c.bodyFrom || "#3a4558",
    furD: c.bodyTo || "#1e2430",
    furL: c.sideHi || "#5a6a80",
    ear: c.accent || "#3ec8ff",
    earIn: c.accentSoft || "#9ae8ff",
    outline: "#141820",
    belly: "#f2f6fa",
    nose: "#1a1420",
    cheek: c.accentSoft || "#9ae8ff",
  };
});

const earPixels = computed((): Pix[] => {
  const p = palette.value;
  const o = (x: number, y: number): Pix => ({ x, y, fill: p.outline });
  const e = (x: number, y: number): Pix => ({ x, y, fill: p.ear });
  const ei = (x: number, y: number): Pix => ({ x, y, fill: p.earIn });
  const f = (x: number, y: number): Pix => ({ x, y, fill: p.fur });
  return [
    // 左耳
    o(13, 8),
    o(14, 7),
    o(15, 6),
    e(14, 8),
    e(15, 7),
    ei(15, 8),
    f(15, 9),
    o(16, 7),
    o(16, 8),
    // 右耳
    o(24, 8),
    o(25, 7),
    o(26, 6),
    e(25, 8),
    e(26, 7),
    ei(26, 8),
    f(26, 9),
    o(27, 7),
    o(27, 8),
  ];
});

const bodyPixels = computed((): Pix[] => {
  const p = palette.value;
  const o = (x: number, y: number): Pix => ({ x, y, fill: p.outline });
  const f = (x: number, y: number): Pix => ({ x, y, fill: p.fur });
  const d = (x: number, y: number): Pix => ({ x, y, fill: p.furD });
  const l = (x: number, y: number): Pix => ({ x, y, fill: p.furL });
  const b = (x: number, y: number): Pix => ({ x, y, fill: p.belly });
  const n = (x: number, y: number): Pix => ({ x, y, fill: p.nose });
  const ck = (x: number, y: number): Pix => ({ x, y, fill: p.cheek });

  const head: Pix[] = [];
  // 头顶到下颌
  for (let x = 15; x <= 26; x++) head.push(o(x, 10));
  for (let y = 11; y <= 15; y++) {
    head.push(o(14, y), o(27, y));
    for (let x = 15; x <= 26; x++) {
      if (y === 11 && (x === 15 || x === 26)) head.push(l(x, y));
      else if (y >= 13 && y <= 14 && (x === 16 || x === 25)) head.push(ck(x, y));
      else head.push(f(x, y));
    }
  }
  // 眼窝留白区由 SVG eyes 覆盖，这里填毛色底
  head.push(
    o(15, 16),
    f(16, 16),
    f(17, 16),
    f(18, 16),
    f(19, 16),
    f(20, 16),
    f(21, 16),
    f(22, 16),
    f(23, 16),
    f(24, 16),
    f(25, 16),
    o(26, 16),
    o(16, 17),
    f(17, 17),
    f(18, 17),
    n(19, 17),
    n(20, 17),
    n(21, 17),
    f(22, 17),
    f(23, 17),
    o(24, 17),
    o(17, 18),
    b(18, 18),
    b(19, 18),
    b(20, 18),
    b(21, 18),
    b(22, 18),
    o(23, 18)
  );

  const torso: Pix[] = [
    o(16, 19),
    d(17, 19),
    f(18, 19),
    b(19, 19),
    b(20, 19),
    b(21, 19),
    f(22, 19),
    d(23, 19),
    o(24, 19),
    o(15, 20),
    d(16, 20),
    f(17, 20),
    b(18, 20),
    b(19, 20),
    b(20, 20),
    b(21, 20),
    b(22, 20),
    f(23, 20),
    d(24, 20),
    o(25, 20),
    o(15, 21),
    d(16, 21),
    f(17, 21),
    b(18, 21),
    b(19, 21),
    b(20, 21),
    b(21, 21),
    b(22, 21),
    f(23, 21),
    d(24, 21),
    o(25, 21),
    o(15, 22),
    d(16, 22),
    f(17, 22),
    b(18, 22),
    b(19, 22),
    b(20, 22),
    b(21, 22),
    b(22, 22),
    f(23, 22),
    d(24, 22),
    o(25, 22),
    o(16, 23),
    f(17, 23),
    f(18, 23),
    b(19, 23),
    b(20, 23),
    b(21, 23),
    f(22, 23),
    f(23, 23),
    o(24, 23),
    // 前爪
    o(16, 24),
    d(16, 25),
    o(16, 26),
    o(17, 26),
    o(23, 24),
    d(24, 25),
    o(24, 26),
    o(25, 26),
    // 后腿
    o(18, 24),
    d(18, 25),
    o(18, 26),
    o(19, 26),
    o(21, 24),
    d(22, 25),
    o(22, 26),
    o(23, 26),
  ];

  return [...head, ...torso];
});

const tailPixels = computed((): Pix[] => {
  const p = palette.value;
  const o = (x: number, y: number): Pix => ({ x, y, fill: p.outline });
  const d = (x: number, y: number): Pix => ({ x, y, fill: p.furD });
  const e = (x: number, y: number): Pix => ({ x, y, fill: p.ear });
  const ei = (x: number, y: number): Pix => ({ x, y, fill: p.earIn });
  return [
    o(25, 19),
    d(26, 18),
    d(27, 17),
    e(28, 16),
    e(29, 15),
    ei(29, 16),
    e(30, 15),
    ei(30, 16),
    e(31, 16),
    o(31, 15),
    o(32, 16),
    e(31, 17),
    e(30, 17),
    o(29, 17),
    o(28, 18),
    d(27, 19),
  ];
});

/** 身后呼吸光晕（贴体淡光，整组呼吸） */
const breathPixels = computed((): Pix[] => {
  const a = props.visual.accent;
  const s = props.visual.accentSoft;
  return [
    { x: 15, y: 12, fill: s, opacity: 0.28 },
    { x: 16, y: 11, fill: a, opacity: 0.22 },
    { x: 17, y: 10, fill: s, opacity: 0.16 },
    { x: 22, y: 10, fill: s, opacity: 0.16 },
    { x: 23, y: 11, fill: a, opacity: 0.22 },
    { x: 24, y: 12, fill: s, opacity: 0.28 },
    { x: 14, y: 15, fill: a, opacity: 0.16 },
    { x: 14, y: 16, fill: s, opacity: 0.2 },
    { x: 25, y: 15, fill: a, opacity: 0.16 },
    { x: 25, y: 16, fill: s, opacity: 0.2 },
    { x: 15, y: 20, fill: a, opacity: 0.18 },
    { x: 24, y: 20, fill: a, opacity: 0.18 },
    { x: 16, y: 21, fill: s, opacity: 0.14 },
    { x: 23, y: 21, fill: s, opacity: 0.14 },
    { x: 19, y: 9, fill: s, opacity: 0.25 },
    { x: 20, y: 9, fill: a, opacity: 0.2 },
    { x: 18, y: 22, fill: s, opacity: 0.12 },
    { x: 21, y: 22, fill: a, opacity: 0.12 },
  ];
});

type FloatParticle = {
  delay: string;
  dur: string;
  rise: string;
  drift: string;
  cells: Pix[];
};

/** 漂浮粒子：错峰出现/上浮/漂移/消失；含单点与小十字星 */
const floatParticles = computed((): FloatParticle[] => {
  const a = props.visual.accent;
  const s = props.visual.accentSoft;
  const hi = "#f2ffff";
  const cross = (x: number, y: number, fill: string, o = 0.85): Pix[] => [
    { x, y, fill, opacity: o },
    { x: x - 1, y, fill, opacity: o * 0.55 },
    { x: x + 1, y, fill, opacity: o * 0.55 },
    { x, y: y - 1, fill, opacity: o * 0.55 },
    { x, y: y + 1, fill, opacity: o * 0.55 },
  ];
  const dot = (x: number, y: number, fill: string, o = 0.8): Pix[] => [
    { x, y, fill, opacity: o },
  ];

  return [
    { delay: "0s", dur: "2.6s", rise: "-4px", drift: "1px", cells: cross(17, 7, hi, 0.9) },
    { delay: "0.35s", dur: "2.9s", rise: "-5px", drift: "-1.5px", cells: dot(23, 6, a, 0.85) },
    { delay: "0.7s", dur: "2.4s", rise: "-3px", drift: "2px", cells: dot(12, 10, s, 0.75) },
    { delay: "1.1s", dur: "3.1s", rise: "-6px", drift: "-1px", cells: cross(27, 9, a, 0.8) },
    { delay: "0.2s", dur: "2.7s", rise: "-4px", drift: "1.5px", cells: dot(8, 14, s, 0.7) },
    { delay: "1.4s", dur: "2.5s", rise: "-5px", drift: "-2px", cells: dot(31, 13, a, 0.7) },
    { delay: "0.55s", dur: "3.2s", rise: "-3px", drift: "0.5px", cells: cross(20, 5, s, 0.75) },
    { delay: "1.8s", dur: "2.8s", rise: "-4px", drift: "-1px", cells: dot(14, 8, a, 0.65) },
    { delay: "0.9s", dur: "2.3s", rise: "-5px", drift: "2px", cells: dot(26, 7, hi, 0.7) },
    { delay: "2.0s", dur: "3.0s", rise: "-3px", drift: "-0.5px", cells: dot(10, 18, s, 0.55) },
    { delay: "1.25s", dur: "2.6s", rise: "-4px", drift: "1px", cells: dot(29, 17, a, 0.55) },
    { delay: "0.15s", dur: "2.2s", rise: "-6px", drift: "-1.5px", cells: cross(22, 4, a, 0.7) },
    { delay: "1.6s", dur: "2.9s", rise: "-3px", drift: "2.5px", cells: dot(6, 11, hi, 0.5) },
    { delay: "2.2s", dur: "2.5s", rise: "-5px", drift: "-2px", cells: dot(33, 15, s, 0.5) },
    { delay: "0.45s", dur: "3.4s", rise: "-7px", drift: "1px", cells: cross(15, 5, s, 0.65) },
    { delay: "2.4s", dur: "2.7s", rise: "-4px", drift: "-1px", cells: dot(18, 6, a, 0.6) },
    { delay: "1.05s", dur: "2.1s", rise: "-5px", drift: "1.5px", cells: dot(25, 12, hi, 0.55) },
    { delay: "2.6s", dur: "3.3s", rise: "-3px", drift: "-2px", cells: dot(11, 13, a, 0.5) },
  ];
});

/**
 * 光翼：参考机甲光翼——肩部关节向外扇形展开的能量刃片
 * 每侧 4 片（主 / 中 / 支1 / 支2），片间留空，斜向展开而非横条堆叠
 */
function buildLightWing(
  side: "l" | "r",
  a: string,
  s: string,
  style: PetToonDecorId | null | undefined
): Pix[] {
  const mir = (x: number) => (side === "l" ? x : 39 - x);
  const out: Pix[] = [];
  const put = (x: number, y: number, fill: string, opacity = 1) => {
    out.push({ x: mir(x), y, fill, opacity });
  };
  const hi = "#e8ffff";
  const kind = style || "crystal";

  // 肩关节（小，不粘连翼片）
  put(14, 17, s, 0.75);
  put(13, 17, a, 0.55);

  if (kind === "lantern") {
    // 暖扇：略圆的扇叶，仍斜向展开
    // ① 上主叶
    put(12, 14, a, 0.95);
    put(11, 13, a, 0.95);
    put(10, 12, s, 0.9);
    put(9, 12, a, 0.75);
    put(12, 15, s, 0.9);
    put(11, 14, s, 0.95);
    put(10, 13, a, 0.85);
    put(11, 12, hi, 0.4);
    // ② 中叶（空一格后）
    put(12, 17, a, 0.9);
    put(11, 17, s, 0.9);
    put(10, 16, a, 0.85);
    put(9, 16, s, 0.7);
    put(11, 18, a, 0.7);
    put(10, 17, a, 0.75);
    // ③ 支叶
    put(12, 20, a, 0.75);
    put(11, 20, s, 0.7);
    put(10, 19, a, 0.55);
    // ④ 更小支叶
    put(12, 22, s, 0.55);
    put(11, 22, a, 0.5);
    put(10, 22, s, 0.35);
    return out;
  }

  if (kind === "blossom") {
    // 花瓣：外缘偏软，仍扇形
    // ①
    put(12, 14, s, 0.95);
    put(11, 13, a, 0.9);
    put(10, 12, s, 0.85);
    put(9, 12, a, 0.65);
    put(12, 15, a, 0.9);
    put(11, 14, s, 0.95);
    put(10, 13, a, 0.8);
    put(11, 12, hi, 0.4);
    // ②
    put(12, 17, a, 0.85);
    put(11, 17, s, 0.9);
    put(10, 16, a, 0.8);
    put(9, 16, s, 0.6);
    put(11, 18, a, 0.7);
    put(10, 17, s, 0.7);
    // ③
    put(12, 20, s, 0.7);
    put(11, 20, a, 0.7);
    put(10, 19, s, 0.5);
    // ④
    put(11, 22, a, 0.5);
    put(10, 22, s, 0.45);
    put(10, 23, a, 0.35);
    return out;
  }

  if (kind === "star") {
    // 月牙碎翼：尖端带星光
    // ①
    put(12, 14, a, 0.95);
    put(11, 13, a, 0.95);
    put(10, 12, s, 0.9);
    put(9, 11, a, 0.7);
    put(12, 15, s, 0.85);
    put(11, 14, s, 0.9);
    put(10, 13, a, 0.8);
    put(10, 11, hi, 0.45);
    // ②
    put(12, 17, a, 0.9);
    put(11, 17, a, 0.85);
    put(10, 16, s, 0.8);
    put(9, 15, a, 0.55);
    put(11, 18, s, 0.65);
    // ③ 星尖
    put(12, 20, a, 0.7);
    put(11, 20, hi, 0.55);
    put(10, 19, s, 0.45);
    // ④ 更小星尖
    put(12, 22, s, 0.5);
    put(11, 23, a, 0.45);
    put(10, 22, hi, 0.35);
    return out;
  }

  // crystal 青焰晶：锐利光刃扇形（最接近参考图）
  // ① 最上最长：斜上外展
  put(12, 15, a, 0.95);
  put(11, 14, a, 0.95);
  put(10, 13, a, 0.95);
  put(9, 12, a, 0.9);
  put(8, 11, s, 0.75);
  put(12, 16, s, 0.85);
  put(11, 15, s, 0.95);
  put(10, 14, s, 0.9);
  put(9, 13, a, 0.8);
  put(11, 13, hi, 0.45);
  put(10, 12, hi, 0.4);
  put(8, 12, a, 0.45);
  // ② 中刃：更水平外展（与①隔空）
  put(12, 18, a, 0.9);
  put(11, 18, a, 0.95);
  put(10, 17, a, 0.9);
  put(9, 16, s, 0.85);
  put(8, 16, a, 0.65);
  put(11, 19, s, 0.7);
  put(10, 18, s, 0.8);
  put(9, 17, a, 0.7);
  put(10, 16, hi, 0.35);
  // ③ 支刃：斜下外展
  put(12, 21, a, 0.8);
  put(11, 21, a, 0.85);
  put(10, 20, s, 0.75);
  put(9, 20, a, 0.55);
  put(11, 22, s, 0.55);
  put(10, 21, a, 0.6);
  // ④ 更小支刃：更下、更短
  put(12, 24, s, 0.6);
  put(11, 24, a, 0.65);
  put(10, 23, s, 0.5);
  put(11, 25, a, 0.4);

  return out;
}

const leftWingPixels = computed((): Pix[] =>
  buildLightWing(
    "l",
    props.visual.accent,
    props.visual.accentSoft,
    props.decor
  )
);

const rightWingPixels = computed((): Pix[] =>
  buildLightWing(
    "r",
    props.visual.accent,
    props.visual.accentSoft,
    props.decor
  )
);

/** 头顶虫洞椭圆（自上而下掉出） */
const portalPixels = computed((): Pix[] => {
  const a = props.visual.accent;
  const s = props.visual.accentSoft;
  const core = "#0a1020";
  return [
    // 外环（偏上）
    { x: 12, y: 5, fill: a, opacity: 0.55 },
    { x: 13, y: 4, fill: s, opacity: 0.7 },
    { x: 14, y: 4, fill: a, opacity: 0.8 },
    { x: 15, y: 3, fill: s },
    { x: 16, y: 3, fill: a },
    { x: 17, y: 3, fill: s },
    { x: 18, y: 3, fill: a },
    { x: 19, y: 3, fill: s },
    { x: 20, y: 3, fill: a },
    { x: 21, y: 3, fill: s },
    { x: 22, y: 3, fill: a },
    { x: 23, y: 3, fill: s },
    { x: 24, y: 3, fill: a },
    { x: 25, y: 4, fill: s, opacity: 0.8 },
    { x: 26, y: 4, fill: a, opacity: 0.7 },
    { x: 27, y: 5, fill: s, opacity: 0.55 },
    // 内圈黑洞
    { x: 14, y: 5, fill: a, opacity: 0.45 },
    { x: 15, y: 5, fill: core },
    { x: 16, y: 4, fill: core },
    { x: 17, y: 4, fill: core },
    { x: 18, y: 4, fill: "#122038" },
    { x: 19, y: 4, fill: core },
    { x: 20, y: 4, fill: "#122038" },
    { x: 21, y: 4, fill: core },
    { x: 22, y: 4, fill: core },
    { x: 23, y: 4, fill: core },
    { x: 24, y: 5, fill: a, opacity: 0.45 },
    { x: 16, y: 5, fill: a, opacity: 0.35 },
    { x: 17, y: 5, fill: s, opacity: 0.4 },
    { x: 18, y: 5, fill: a, opacity: 0.5 },
    { x: 19, y: 5, fill: s, opacity: 0.55 },
    { x: 20, y: 5, fill: a, opacity: 0.5 },
    { x: 21, y: 5, fill: s, opacity: 0.4 },
    { x: 22, y: 5, fill: a, opacity: 0.35 },
    // 上缘光晕
    { x: 17, y: 2, fill: s, opacity: 0.45 },
    { x: 18, y: 2, fill: a, opacity: 0.55 },
    { x: 19, y: 2, fill: s, opacity: 0.65 },
    { x: 20, y: 2, fill: a, opacity: 0.55 },
    { x: 21, y: 2, fill: s, opacity: 0.45 },
    { x: 18, y: 1, fill: a, opacity: 0.35 },
    { x: 19, y: 1, fill: s, opacity: 0.4 },
    { x: 20, y: 1, fill: a, opacity: 0.35 },
  ];
});

/** 主题专属装饰：水晶 / 灯笼 / 花 / 星月 */
const decorPixels = computed((): Pix[] => {
  const a = props.visual.accent;
  const s = props.visual.accentSoft;
  const o = "#141820";
  switch (props.decor) {
    case "crystal":
      return [
        { x: 19, y: 4, fill: o },
        { x: 20, y: 4, fill: a },
        { x: 21, y: 4, fill: o },
        { x: 19, y: 5, fill: a },
        { x: 20, y: 5, fill: s },
        { x: 21, y: 5, fill: a },
        { x: 20, y: 6, fill: a },
      ];
    case "lantern":
      return [
        { x: 8, y: 18, fill: o },
        { x: 7, y: 19, fill: a },
        { x: 8, y: 19, fill: s },
        { x: 9, y: 19, fill: a },
        { x: 7, y: 20, fill: a },
        { x: 8, y: 20, fill: s },
        { x: 9, y: 20, fill: a },
        { x: 8, y: 21, fill: o },
      ];
    case "blossom":
      return [
        { x: 12, y: 9, fill: a, opacity: 0.9 },
        { x: 11, y: 10, fill: s },
        { x: 12, y: 10, fill: a },
        { x: 13, y: 10, fill: s },
        { x: 12, y: 11, fill: a },
        { x: 28, y: 9, fill: s, opacity: 0.85 },
        { x: 27, y: 10, fill: a },
        { x: 28, y: 10, fill: s },
        { x: 29, y: 10, fill: a },
      ];
    case "star":
      return [
        { x: 19, y: 3, fill: s },
        { x: 20, y: 2, fill: a },
        { x: 21, y: 3, fill: s },
        { x: 20, y: 4, fill: a },
        { x: 32, y: 8, fill: s, opacity: 0.8 },
        { x: 33, y: 9, fill: a, opacity: 0.7 },
        { x: 6, y: 9, fill: s, opacity: 0.65 },
      ];
    default:
      return [];
  }
});

/** 动作场景：更易辨认的水壶 / 草丛 / 火焰 / 水柱 / 雷云 / 残影 */
const scenePixels = computed((): Pix[] => {
  const a = props.visual.accent;
  const s = props.visual.accentSoft;
  const green = "#5ecf5a";
  const greenD = "#2f8a36";
  const greenL = "#a6f08a";
  const water = "#4eb8ff";
  const waterD = "#2a7ec8";
  const fire = "#ff5a1a";
  const fireM = "#ff8a28";
  const fireH = "#ffe066";
  const bolt = "#ffe566";
  const cloud = "#e8eef8";
  const cloudD = "#9aa8c0";
  const wood = "#8a5a32";
  const woodD = "#5a3a20";
  switch (animState.value) {
    case "water":
      return [
        // 水壶壶身
        { x: 3, y: 15, fill: woodD },
        { x: 4, y: 15, fill: wood },
        { x: 5, y: 15, fill: wood },
        { x: 6, y: 15, fill: woodD },
        { x: 3, y: 16, fill: wood },
        { x: 4, y: 16, fill: "#c0d8e8" },
        { x: 5, y: 16, fill: "#a8c8e0" },
        { x: 6, y: 16, fill: wood },
        { x: 3, y: 17, fill: woodD },
        { x: 4, y: 17, fill: wood },
        { x: 5, y: 17, fill: wood },
        { x: 6, y: 17, fill: woodD },
        // 壶嘴
        { x: 7, y: 15, fill: wood },
        { x: 8, y: 14, fill: woodD },
        { x: 9, y: 13, fill: wood },
        // 把手
        { x: 2, y: 15, fill: woodD },
        { x: 2, y: 16, fill: wood },
        { x: 2, y: 17, fill: woodD },
        // 水柱
        { x: 10, y: 14, fill: water },
        { x: 11, y: 15, fill: water },
        { x: 12, y: 17, fill: water, opacity: 0.9 },
        { x: 12, y: 19, fill: water, opacity: 0.75 },
        { x: 13, y: 21, fill: water, opacity: 0.65 },
        { x: 13, y: 23, fill: waterD, opacity: 0.7 },
        // 草丛被浇
        { x: 12, y: 26, fill: greenD },
        { x: 13, y: 24, fill: green },
        { x: 13, y: 25, fill: greenD },
        { x: 14, y: 23, fill: greenL },
        { x: 14, y: 25, fill: green },
        { x: 15, y: 24, fill: green },
        { x: 15, y: 26, fill: greenD },
        { x: 16, y: 25, fill: green },
      ];
    case "grass":
      return [
        // 左草丛（多片叶）
        { x: 4, y: 27, fill: greenD },
        { x: 5, y: 25, fill: green },
        { x: 5, y: 26, fill: greenD },
        { x: 6, y: 23, fill: greenL },
        { x: 6, y: 24, fill: green },
        { x: 6, y: 26, fill: greenD },
        { x: 7, y: 22, fill: green },
        { x: 7, y: 24, fill: greenL },
        { x: 7, y: 25, fill: greenD },
        { x: 8, y: 23, fill: green },
        { x: 8, y: 26, fill: greenD },
        { x: 9, y: 24, fill: greenL },
        { x: 9, y: 25, fill: green },
        // 小花
        { x: 7, y: 21, fill: "#ff7ab8" },
        { x: 6, y: 21, fill: "#ffd060" },
        { x: 8, y: 21, fill: "#ff7ab8" },
        // 右草丛
        { x: 28, y: 27, fill: greenD },
        { x: 29, y: 25, fill: green },
        { x: 29, y: 26, fill: greenD },
        { x: 30, y: 23, fill: greenL },
        { x: 30, y: 24, fill: green },
        { x: 31, y: 22, fill: green },
        { x: 31, y: 25, fill: greenD },
        { x: 32, y: 24, fill: greenL },
        { x: 33, y: 26, fill: greenD },
      ];
    case "fire":
      return [
        // 口喷火焰（近大远小，黄心橙边）
        { x: 13, y: 17, fill: fireH },
        { x: 12, y: 16, fill: fireM },
        { x: 12, y: 17, fill: fireH },
        { x: 12, y: 18, fill: fireM },
        { x: 11, y: 15, fill: fire },
        { x: 11, y: 16, fill: fireH },
        { x: 11, y: 17, fill: fireM },
        { x: 11, y: 18, fill: fire },
        { x: 10, y: 14, fill: fireM },
        { x: 10, y: 15, fill: fireH },
        { x: 10, y: 16, fill: fire },
        { x: 10, y: 17, fill: fireM },
        { x: 9, y: 13, fill: fire },
        { x: 9, y: 14, fill: fireH },
        { x: 9, y: 15, fill: fireM },
        { x: 9, y: 16, fill: fire },
        { x: 8, y: 12, fill: fireM },
        { x: 8, y: 13, fill: fire },
        { x: 8, y: 14, fill: fireH },
        { x: 8, y: 15, fill: fire },
        { x: 7, y: 11, fill: fire },
        { x: 7, y: 12, fill: fireM },
        { x: 7, y: 13, fill: fire },
        { x: 6, y: 10, fill: fireM, opacity: 0.85 },
        { x: 6, y: 11, fill: fire, opacity: 0.9 },
        { x: 5, y: 9, fill: fireH, opacity: 0.7 },
        { x: 5, y: 10, fill: fire, opacity: 0.75 },
        { x: 4, y: 8, fill: fireM, opacity: 0.55 },
      ];
    case "splash":
      return [
        // 水柱
        { x: 13, y: 17, fill: water },
        { x: 12, y: 16, fill: water },
        { x: 12, y: 17, fill: "#b8e8ff" },
        { x: 12, y: 18, fill: water },
        { x: 11, y: 15, fill: waterD },
        { x: 11, y: 16, fill: water },
        { x: 11, y: 17, fill: "#b8e8ff" },
        { x: 11, y: 18, fill: waterD },
        { x: 10, y: 14, fill: water },
        { x: 10, y: 15, fill: "#b8e8ff" },
        { x: 10, y: 16, fill: water },
        { x: 9, y: 13, fill: waterD },
        { x: 9, y: 14, fill: water },
        { x: 8, y: 12, fill: water },
        { x: 8, y: 13, fill: "#b8e8ff" },
        { x: 7, y: 11, fill: water, opacity: 0.85 },
        // 水花
        { x: 6, y: 10, fill: s, opacity: 0.8 },
        { x: 5, y: 12, fill: water, opacity: 0.7 },
        { x: 6, y: 14, fill: water, opacity: 0.65 },
        { x: 7, y: 16, fill: water, opacity: 0.55 },
        { x: 4, y: 15, fill: water, opacity: 0.5 },
        // 地面水洼
        { x: 8, y: 27, fill: waterD, opacity: 0.55 },
        { x: 9, y: 27, fill: water, opacity: 0.6 },
        { x: 10, y: 27, fill: waterD, opacity: 0.5 },
      ];
    case "thunder":
      return [
        // 雷云
        { x: 14, y: 3, fill: cloudD },
        { x: 15, y: 2, fill: cloud },
        { x: 16, y: 2, fill: cloud },
        { x: 17, y: 1, fill: cloud },
        { x: 18, y: 1, fill: cloud },
        { x: 19, y: 1, fill: cloud },
        { x: 20, y: 1, fill: cloud },
        { x: 21, y: 1, fill: cloud },
        { x: 22, y: 2, fill: cloud },
        { x: 23, y: 2, fill: cloud },
        { x: 24, y: 3, fill: cloudD },
        { x: 15, y: 3, fill: cloud },
        { x: 16, y: 3, fill: cloudD },
        { x: 17, y: 2, fill: cloud },
        { x: 18, y: 2, fill: cloudD },
        { x: 19, y: 2, fill: cloud },
        { x: 20, y: 2, fill: cloudD },
        { x: 21, y: 2, fill: cloud },
        { x: 22, y: 3, fill: cloud },
        { x: 23, y: 3, fill: cloudD },
        // 闪电 Z 形
        { x: 19, y: 4, fill: bolt },
        { x: 20, y: 5, fill: bolt },
        { x: 19, y: 6, fill: bolt },
        { x: 18, y: 6, fill: bolt },
        { x: 18, y: 7, fill: bolt },
        { x: 19, y: 8, fill: bolt },
        { x: 20, y: 9, fill: a },
        { x: 19, y: 10, fill: bolt },
      ];
    case "dodge":
      return [
        // 残影剪影（头+身）
        { x: 8, y: 12, fill: a, opacity: 0.35 },
        { x: 9, y: 11, fill: a, opacity: 0.4 },
        { x: 10, y: 11, fill: a, opacity: 0.4 },
        { x: 11, y: 12, fill: a, opacity: 0.35 },
        { x: 8, y: 13, fill: a, opacity: 0.3 },
        { x: 9, y: 13, fill: s, opacity: 0.35 },
        { x: 10, y: 13, fill: s, opacity: 0.35 },
        { x: 11, y: 13, fill: a, opacity: 0.3 },
        { x: 9, y: 14, fill: a, opacity: 0.28 },
        { x: 10, y: 14, fill: a, opacity: 0.28 },
        { x: 8, y: 16, fill: a, opacity: 0.25 },
        { x: 9, y: 15, fill: a, opacity: 0.3 },
        { x: 10, y: 15, fill: a, opacity: 0.3 },
        { x: 11, y: 16, fill: a, opacity: 0.25 },
        { x: 9, y: 17, fill: a, opacity: 0.22 },
        { x: 10, y: 17, fill: a, opacity: 0.22 },
        { x: 9, y: 19, fill: a, opacity: 0.18 },
        { x: 10, y: 19, fill: a, opacity: 0.18 },
        // 速度线
        { x: 5, y: 14, fill: s, opacity: 0.45 },
        { x: 4, y: 15, fill: s, opacity: 0.35 },
        { x: 3, y: 16, fill: s, opacity: 0.25 },
      ];
    default:
      return [];
  }
});
</script>

<style scoped>
.pix {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  pointer-events: none;
  user-select: none;
  z-index: 1;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.pix-shadow {
  position: absolute;
  left: 22%;
  right: 22%;
  bottom: 4%;
  height: 9%;
  border-radius: 50%;
  background: radial-gradient(
    ellipse,
    color-mix(in srgb, var(--pix-accent) 40%, transparent),
    rgba(0, 0, 0, 0.4) 55%,
    transparent 72%
  );
  filter: blur(1px);
  opacity: 0.9;
  animation: shadow-breathe 1.4s ease-in-out infinite;
}

.pix-stage {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  transform-origin: 50% 88%;
  will-change: transform;
}

.pix-portal-svg {
  position: absolute;
  inset: 0;
  z-index: 3;
  width: 92%;
  height: 92%;
  margin: auto;
  pointer-events: none;
  overflow: visible;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.pix-svg {
  width: 92%;
  height: 92%;
  overflow: visible;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.pix-ears {
  transform-origin: 20px 10px;
  animation: ear-twitch 2.4s ease-in-out infinite;
}

.pix-tail {
  transform-origin: 26px 20px;
  animation: tail-wag 1.1s ease-in-out infinite;
}

.pix-aura {
  pointer-events: none;
}

.pix-breath {
  transform-box: fill-box;
  transform-origin: center;
  animation: aura-breath 2.8s ease-in-out infinite;
}

.pix-particle {
  transform-box: fill-box;
  transform-origin: center;
  animation: particle-life var(--p-dur, 2.6s) ease-in-out infinite;
  animation-delay: var(--p-delay, 0s);
}

.pix-aura[data-sleep="1"] .pix-breath {
  animation-duration: 4.5s;
  opacity: 0.45;
}

.pix-aura[data-sleep="1"] .pix-particle {
  animation-duration: 4.2s;
  opacity: 0.55;
}

.pix-wings {
  transform-origin: 20px 17px;
  /* 轻外发光，贴近参考光翼 */
  filter: drop-shadow(0 0 1px color-mix(in srgb, var(--pix-accent) 55%, transparent));
}

.pix-wing--l {
  transform-origin: 13px 17px;
  animation: lightwing-l 2.4s ease-in-out infinite;
}

.pix-wing--r {
  transform-origin: 26px 17px;
  animation: lightwing-r 2.4s ease-in-out infinite;
  animation-delay: -0.6s;
}

.pix-z {
  position: absolute;
  top: 10%;
  right: 16%;
  font-family: "Courier New", monospace;
  font-size: clamp(12px, 12%, 18px);
  font-weight: 700;
  color: var(--pix-accent-soft);
  animation: zzz 1.4s ease-in-out infinite;
}

.pix-spark {
  position: absolute;
  top: 12%;
  right: 18%;
  width: 10%;
  height: 10%;
  min-width: 8px;
  min-height: 8px;
  background: var(--pix-accent);
  clip-path: polygon(
    50% 0%,
    61% 35%,
    98% 35%,
    68% 57%,
    79% 91%,
    50% 70%,
    21% 91%,
    32% 57%,
    2% 35%,
    39% 35%
  );
  animation: spark 0.7s ease-in-out infinite;
}

/* —— 动作 —— */
.pix[data-anim="idle"] .pix-stage {
  animation: idle-bob 1.35s ease-in-out infinite;
}
.pix[data-anim="sway"] .pix-stage {
  animation: sway 0.95s ease-in-out infinite;
}
.pix[data-anim="walk"] .pix-stage {
  animation: walk-bob 0.34s ease-in-out infinite;
}
.pix[data-anim="walk"] .pix-body {
  animation: walk-nudge 0.34s ease-in-out infinite;
}
.pix[data-anim="walk"] .pix-tail {
  animation: tail-wag 0.34s ease-in-out infinite;
}
.pix[data-anim="wave"] .pix-particle {
  animation-duration: 1.4s;
}
.pix[data-anim="wave"] .pix-breath {
  animation: aura-breath 1.2s ease-in-out infinite;
}
.pix[data-anim="wave"] .pix-stage {
  animation: idle-bob 1s ease-in-out infinite;
}
.pix[data-anim="wave"] .pix-ears {
  animation: ear-twitch 0.4s ease-in-out infinite;
}
.pix[data-anim="read"] .pix-stage {
  animation: sniff 0.7s ease-in-out infinite;
}
.pix[data-anim="tea"] .pix-particle {
  animation-duration: 1.2s;
}
.pix[data-anim="tea"] .pix-breath {
  animation: aura-breath 1s ease-in-out infinite;
}
.pix[data-anim="tea"] .pix-stage {
  animation: puff 0.55s ease-in-out infinite;
}
.pix[data-anim="tilt"] .pix-stage {
  animation: tilt 0.85s ease-in-out infinite;
}
.pix[data-anim="happy"] .pix-stage {
  animation: hop 0.42s ease-in-out 5;
}
.pix[data-anim="happy"] .pix-ears {
  animation: ear-twitch 0.28s ease-in-out infinite;
}
.pix[data-anim="peek"] .pix-stage {
  animation: peek 1.05s ease-in-out 1;
}
.pix[data-anim="sleep"] .pix-stage {
  animation: sleep 2.2s ease-in-out infinite;
}
.pix[data-anim="sleep"] .pix-eyes,
.pix[data-mood="sleep"] .pix-eyes {
  opacity: 0;
}
.pix[data-anim="sleep"] .pix-aura,
.pix[data-mood="sleep"] .pix-aura {
  opacity: 0.4;
}
.pix[data-anim="sleep"] .pix-tail {
  opacity: 0.35;
  animation: none;
}

.pix[data-anim="water"] .pix-stage {
  animation: sniff 0.75s ease-in-out infinite;
}
.pix[data-anim="water"] .pix-scene {
  animation: scene-pour 0.55s ease-in-out infinite;
}
.pix[data-anim="grass"] .pix-stage {
  animation: sway 0.9s ease-in-out infinite;
}
.pix[data-anim="grass"] .pix-scene {
  animation: scene-sway 0.7s ease-in-out infinite;
}
.pix[data-anim="fire"] .pix-stage {
  animation: puff 0.4s ease-in-out infinite;
}
.pix[data-anim="fire"] .pix-scene {
  animation: scene-burst 0.35s ease-in-out infinite;
}
.pix[data-anim="splash"] .pix-stage {
  animation: walk-bob 0.4s ease-in-out infinite;
}
.pix[data-anim="splash"] .pix-scene {
  animation: scene-burst 0.32s ease-in-out infinite;
}
.pix[data-anim="thunder"] .pix-stage {
  animation: hop 0.5s ease-in-out 3;
}
.pix[data-anim="thunder"] .pix-scene {
  animation: scene-flash 0.28s steps(2) infinite;
}
.pix[data-anim="dodge"] .pix-stage {
  animation: peek 0.7s ease-in-out infinite;
}
.pix[data-anim="dodge"] .pix-scene {
  animation: scene-fade 0.45s ease-in-out infinite;
}
.pix[data-anim="wormhole"] .pix-stage {
  animation: none;
}

/* 虫洞：下沉隐身 → 头顶传送门 → 自上而下掉出 */
.pix[data-wormhole="out"] .pix-stage {
  animation: wormhole-sink 0.36s ease-in forwards;
}
.pix[data-wormhole="out"] .pix-shadow {
  animation: wormhole-shadow-out 0.36s ease-in forwards;
}
.pix[data-wormhole="warp"] .pix-stage {
  opacity: 0;
  visibility: hidden;
  transform: translateY(-130%);
}
.pix[data-wormhole="warp"] .pix-shadow {
  opacity: 0;
}
.pix[data-wormhole="warp"] .pix-portal {
  animation: portal-open 0.28s ease-out forwards;
}
.pix[data-wormhole="in"] .pix-portal {
  opacity: 1;
  animation: portal-pulse 0.48s ease-in-out;
}
.pix[data-wormhole="in"] .pix-stage {
  visibility: visible;
  animation: wormhole-drop 0.48s cubic-bezier(0.22, 0.82, 0.2, 1) forwards;
}
.pix[data-wormhole="in"] .pix-shadow {
  animation: wormhole-shadow-in 0.48s ease-out forwards;
}


.pix-decor {
  animation: decor-twinkle 1.8s ease-in-out infinite;
}
.pix-scene {
  transform-origin: 20px 22px;
}

@keyframes lightwing-l {
  0%,
  100% {
    opacity: 0.88;
    transform: rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: rotate(-3deg);
  }
}
@keyframes lightwing-r {
  0%,
  100% {
    opacity: 0.88;
    transform: rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: rotate(3deg);
  }
}

@keyframes idle-bob {
  0%,
  100% {
    transform: translateY(0) scale(1, 1);
  }
  40% {
    transform: translateY(-5%) scale(1.02, 0.98);
  }
  70% {
    transform: translateY(-2%) scale(0.99, 1.01);
  }
}
@keyframes sway {
  0%,
  100% {
    transform: translateX(-4%) rotate(-5deg);
  }
  50% {
    transform: translateX(4%) rotate(5deg);
  }
}
@keyframes walk-bob {
  0%,
  100% {
    transform: translateY(0) scale(1, 1) rotate(0);
  }
  25% {
    transform: translateY(-7%) scale(1.04, 0.96) rotate(-2deg);
  }
  50% {
    transform: translateY(0) scale(0.98, 1.03) rotate(0);
  }
  75% {
    transform: translateY(-7%) scale(1.04, 0.96) rotate(2deg);
  }
}
@keyframes walk-nudge {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(2%);
  }
}
@keyframes ear-twitch {
  0%,
  70%,
  100% {
    transform: rotate(0);
  }
  78% {
    transform: rotate(-6deg);
  }
  86% {
    transform: rotate(5deg);
  }
}
@keyframes tail-wag {
  0%,
  100% {
    transform: rotate(-8deg) translateY(0);
  }
  50% {
    transform: rotate(10deg) translateY(-1px);
  }
}
@keyframes aura-breath {
  0%,
  100% {
    opacity: 0.45;
    transform: scale(0.94);
  }
  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}
@keyframes particle-life {
  0% {
    opacity: 0;
    transform: translate(0, 2px) scale(0.55);
  }
  14% {
    opacity: 0.95;
    transform: translate(calc(var(--p-drift, 1px) * 0.35), 0) scale(1);
  }
  42% {
    opacity: 1;
    transform: translate(var(--p-drift, 1px), var(--p-rise, -4px)) scale(1.08);
  }
  68% {
    opacity: 0.4;
    transform: translate(calc(var(--p-drift, 1px) * 1.35), calc(var(--p-rise, -4px) * 1.3))
      scale(0.88);
  }
  100% {
    opacity: 0;
    transform: translate(calc(var(--p-drift, 1px) * 1.6), calc(var(--p-rise, -4px) * 1.55))
      scale(0.45);
  }
}
@keyframes sniff {
  0%,
  100% {
    transform: translateY(2%) rotate(3deg);
  }
  35% {
    transform: translateY(4%) rotate(-4deg) scale(1.02, 0.98);
  }
  70% {
    transform: translateY(1%) rotate(2deg);
  }
}
@keyframes puff {
  0%,
  100% {
    transform: scale(1, 1);
  }
  50% {
    transform: scale(1.06, 0.94) translateY(-2%);
  }
}
@keyframes tilt {
  0%,
  100% {
    transform: rotate(-10deg) translateX(-2%);
  }
  50% {
    transform: rotate(-16deg) translateX(-3%);
  }
}
@keyframes hop {
  0%,
  100% {
    transform: translateY(0) scale(1, 1);
  }
  35% {
    transform: translateY(-18%) scale(1.06, 0.92);
  }
  55% {
    transform: translateY(-2%) scale(0.94, 1.08);
  }
}
@keyframes peek {
  0%,
  100% {
    transform: translateX(0) rotate(0);
  }
  25% {
    transform: translateX(10%) rotate(8deg);
  }
  55% {
    transform: translateX(12%) rotate(10deg) scale(1.04, 0.96);
  }
  80% {
    transform: translateX(4%) rotate(3deg);
  }
}
@keyframes sleep {
  0%,
  100% {
    transform: translateY(3%) rotate(-5deg);
  }
  50% {
    transform: translateY(5%) rotate(-7deg);
  }
}
@keyframes shadow-breathe {
  0%,
  100% {
    transform: scaleX(1);
    opacity: 0.85;
  }
  50% {
    transform: scaleX(0.88);
    opacity: 0.65;
  }
}
@keyframes zzz {
  0%,
  100% {
    opacity: 0.45;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(-30%);
  }
}
@keyframes spark {
  0%,
  100% {
    opacity: 0.45;
    transform: scale(0.75) rotate(0);
  }
  50% {
    opacity: 1;
    transform: scale(1.2) rotate(12deg);
  }
}
@keyframes scene-pour {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(4%, 6%);
  }
}
@keyframes scene-sway {
  0%,
  100% {
    transform: rotate(-4deg);
  }
  50% {
    transform: rotate(5deg);
  }
}
@keyframes scene-burst {
  0%,
  100% {
    transform: scale(0.9) translateX(0);
    opacity: 0.75;
  }
  50% {
    transform: scale(1.2) translateX(-8%);
    opacity: 1;
  }
}
@keyframes scene-flash {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}
@keyframes scene-fade {
  0%,
  100% {
    opacity: 0.15;
    transform: translateX(0);
  }
  50% {
    opacity: 0.45;
    transform: translateX(-6%);
  }
}
@keyframes wormhole-sink {
  0% {
    transform: translateY(0) scale(1, 1);
    opacity: 1;
  }
  60% {
    transform: translateY(28%) scale(1.05, 0.72);
    opacity: 0.55;
  }
  100% {
    transform: translateY(55%) scale(0.9, 0.35);
    opacity: 0;
  }
}
@keyframes wormhole-drop {
  0% {
    transform: translateY(-125%) scale(0.88, 1.12);
    opacity: 0;
  }
  18% {
    opacity: 1;
  }
  58% {
    transform: translateY(8%) scale(1.05, 0.88);
    opacity: 1;
  }
  78% {
    transform: translateY(-2%) scale(0.98, 1.04);
  }
  100% {
    transform: translateY(0) scale(1, 1);
    opacity: 1;
  }
}
@keyframes wormhole-shadow-out {
  to {
    opacity: 0;
    transform: scaleX(0.4);
  }
}
@keyframes wormhole-shadow-in {
  from {
    opacity: 0;
    transform: scaleX(0.4);
  }
  to {
    opacity: 0.9;
    transform: scaleX(1);
  }
}
@keyframes portal-open {
  from {
    opacity: 0;
    transform: scaleX(0.2) scaleY(0.4);
  }
  to {
    opacity: 1;
    transform: scaleX(1) scaleY(1);
  }
}
@keyframes portal-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.08);
    opacity: 0.85;
  }
}
@keyframes decor-twinkle {
  0%,
  100% {
    opacity: 0.85;
  }
  50% {
    opacity: 1;
  }
}
</style>
