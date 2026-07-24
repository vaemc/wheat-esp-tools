<template>
  <canvas
    ref="canvasRef"
    class="pet-trail-canvas"
    :class="{ 'is-on': active || fading }"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import type { PetTrailStyle, TrailParticleShape } from "../trailStyles";

const props = withDefaults(
  defineProps<{
    active: boolean;
    /** Trail direction in deg (opposite to motion; 0 = right) */
    angle: number;
    /** 0~1 */
    speed: number;
    palette: PetTrailStyle;
    wormholePhase?: "idle" | "out" | "warp" | "in";
  }>(),
  {
    active: false,
    angle: 0,
    speed: 0,
    wormholePhase: "idle",
  }
);

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  shape: TrailParticleShape;
  hueShift: number;
};

const canvasRef = ref<HTMLCanvasElement | null>(null);
const fading = ref(false);

let raf = 0;
let particles: Particle[] = [];
let emitCarry = 0;
let lastTs = 0;
let dpr = 1;
let cssW = 0;
let cssH = 0;

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function pickShape(shapes: TrailParticleShape[]): TrailParticleShape {
  return shapes[Math.floor(Math.random() * shapes.length)] ?? "dot";
}

function resize() {
  const el = canvasRef.value;
  const parent = el?.parentElement;
  if (!el || !parent) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cssW = parent.clientWidth || 1;
  cssH = parent.clientHeight || 1;
  el.width = Math.max(1, Math.round(cssW * dpr));
  el.height = Math.max(1, Math.round(cssH * dpr));
  el.style.width = `${cssW}px`;
  el.style.height = `${cssH}px`;
  const ctx = el.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function emitBurst(cx: number, cy: number, dt: number) {
  const st = props.palette;
  const spd = Math.max(0, Math.min(1, props.speed));
  if (spd < 0.04) return;

  const rate = (9 + spd * 22) * st.density * dt * 60;
  emitCarry += rate;
  const n = Math.floor(emitCarry);
  emitCarry -= n;
  if (n <= 0) return;

  const rad = (props.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  for (let i = 0; i < n; i++) {
    const fan = (Math.random() - 0.5) * st.fan * (0.55 + spd);
    const c = Math.cos(rad + fan);
    const s = Math.sin(rad + fan);
    const push = (90 + spd * 260) * (0.45 + Math.random() * 0.7);
    const life = rand(st.lifeMs[0], st.lifeMs[1]) / 1000;
    particles.push({
      x: cx + cos * rand(-3, 8) + (Math.random() - 0.5) * 6,
      y: cy + sin * rand(-3, 8) + (Math.random() - 0.5) * 6,
      vx: c * push + (Math.random() - 0.5) * 18,
      vy: s * push + (Math.random() - 0.5) * 18,
      life,
      maxLife: life,
      size: rand(1.1, 2.6 + spd * 1.2),
      shape: pickShape(st.shapes),
      hueShift: Math.random(),
    });
  }

  // Sparse core near the head
  if (spd > 0.28) {
    const coreN = Math.floor(1 + spd * 3.5 * st.density);
    for (let i = 0; i < coreN; i++) {
      const t = Math.random() * 0.35;
      const life = rand(0.18, 0.38);
      particles.push({
        x: cx + cos * t * 22 + (Math.random() - 0.5) * 4,
        y: cy + sin * t * 22 + (Math.random() - 0.5) * 4,
        vx: cos * rand(40, 110) + (Math.random() - 0.5) * 40,
        vy: sin * rand(40, 110) + (Math.random() - 0.5) * 40,
        life,
        maxLife: life,
        size: rand(1.2, 2.8),
        shape: Math.random() > 0.55 ? "dot" : pickShape(st.shapes),
        hueShift: Math.random(),
      });
    }
  }
}

/** Wormhole jump: radial dissipate / arrival sparkle burst */
function emitWormholeBurst(kind: "out" | "in") {
  if (!cssW || !cssH) resize();
  const cx = cssW * 0.5;
  const cy = cssH * 0.5;
  const st = props.palette;
  const count = kind === "out" ? 36 : 30;
  fading.value = true;
  for (let i = 0; i < count; i++) {
    const ang = (Math.PI * 2 * i) / count + rand(-0.12, 0.12);
    const speed =
      kind === "out" ? rand(70, 180) : rand(30, 110);
    const life = kind === "out" ? rand(0.32, 0.7) : rand(0.4, 0.85);
    particles.push({
      x: cx + rand(-6, 6),
      y: cy + (kind === "in" ? rand(-40, -10) : rand(-6, 6)),
      vx: Math.cos(ang) * speed * (kind === "out" ? 1 : 0.55),
      vy:
        kind === "out"
          ? Math.sin(ang) * speed
          : Math.abs(Math.sin(ang)) * speed + rand(30, 90),
      life,
      maxLife: life,
      size: rand(1.2, 2.8),
      shape: pickShape(st.shapes),
      hueShift: Math.random(),
    });
  }
}

function colorAt(p: Particle, age: number): string {
  const st = props.palette;
  if (st.iridescent) {
    const palette = [st.head, st.core, st.mid, st.soft];
    const idx = Math.min(
      palette.length - 1,
      Math.floor(age * palette.length + p.hueShift * 0.4)
    );
    return palette[idx]!;
  }
  if (age < 0.18) return st.head;
  if (age < 0.45) return st.core;
  if (age < 0.72) return st.mid;
  return st.soft;
}

function hexAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: TrailParticleShape,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number
) {
  const s = size;
  // Soft halo first
  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, s * 1.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = alpha * 0.85;
  ctx.fillStyle = color;
  if (shape === "cross") {
    const t = Math.max(0.55, s * 0.28);
    ctx.fillRect(x - s, y - t / 2, s * 2, t);
    ctx.fillRect(x - t / 2, y - s, t, s * 2);
    return;
  }
  if (shape === "spark") {
    ctx.beginPath();
    ctx.ellipse(x, y, s * 1.1, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.35, s * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (shape === "diamond") {
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x + s * 0.55, y, x, y + s);
    ctx.quadraticCurveTo(x - s * 0.55, y, x, y - s);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.arc(x, y, s * 0.55, 0, Math.PI * 2);
  ctx.fill();
}

/** Soft meteor streamer ? no hard triangle blade */
function drawCometHead(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spd: number
) {
  if (spd < 0.05) return;
  const st = props.palette;
  const rad = (props.angle * Math.PI) / 180;
  const len = (22 + spd * 36) * st.headScale;
  const thick = 3.5 + spd * 6;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rad);

  // Wide outer bloom (very soft)
  const bloom = ctx.createRadialGradient(0, 0, 0, 0, 0, thick * 3.2);
  bloom.addColorStop(0, hexAlpha(st.head, 0.1 + spd * 0.08));
  bloom.addColorStop(0.35, hexAlpha(st.core, 0.07));
  bloom.addColorStop(1, hexAlpha(st.soft, 0));
  ctx.globalAlpha = 1;
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.ellipse(len * 0.12, 0, thick * 2.4, thick * 2.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Soft tapered ribbon along trail axis
  const ribbon = ctx.createLinearGradient(0, 0, len, 0);
  ribbon.addColorStop(0, hexAlpha(st.head, 0.16 + spd * 0.1));
  ribbon.addColorStop(0.15, hexAlpha(st.core, 0.16));
  ribbon.addColorStop(0.45, hexAlpha(st.mid, 0.08));
  ribbon.addColorStop(0.75, hexAlpha(st.soft, 0.03));
  ribbon.addColorStop(1, hexAlpha(st.soft, 0));
  ctx.fillStyle = ribbon;
  ctx.beginPath();
  ctx.moveTo(0, -thick * 0.9);
  ctx.bezierCurveTo(len * 0.25, -thick * 1.1, len * 0.55, -thick * 0.35, len, 0);
  ctx.bezierCurveTo(len * 0.55, thick * 0.35, len * 0.25, thick * 1.1, 0, thick * 0.9);
  ctx.closePath();
  ctx.fill();

  // Feathered edge blur pass
  ctx.shadowColor = st.glow;
  ctx.shadowBlur = 10 + spd * 6;
  ctx.globalAlpha = 0.12 + spd * 0.08;
  ctx.fillStyle = hexAlpha(st.core, 0.22);
  ctx.beginPath();
  ctx.ellipse(len * 0.18, 0, len * 0.28, thick * 0.75, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Soft core glow (dimmer ? avoid blinding white center)
  const core = ctx.createRadialGradient(2, 0, 0, 2, 0, 6 + spd * 5);
  core.addColorStop(0, hexAlpha(st.head, 0.22 + spd * 0.1));
  core.addColorStop(0.35, hexAlpha(st.core, 0.14));
  core.addColorStop(1, hexAlpha(st.core, 0));
  ctx.globalAlpha = 1;
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(2, 0, 6 + spd * 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawGroundGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spd: number
) {
  if (spd < 0.08) return;
  const st = props.palette;
  const gy = cy + Math.min(cssH * 0.3, 48);
  const rx = 22 + spd * 28;
  const ry = 5.5 + spd * 4;
  const g = ctx.createRadialGradient(cx, gy, 0, cx, gy, rx);
  g.addColorStop(0, st.ground);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.2 + spd * 0.22;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, gy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function tick(now: number) {
  const el = canvasRef.value;
  if (!el) {
    raf = requestAnimationFrame(tick);
    return;
  }
  const ctx = el.getContext("2d");
  if (!ctx) {
    raf = requestAnimationFrame(tick);
    return;
  }

  if (!cssW || !cssH) resize();

  const dt = lastTs ? Math.min(0.033, (now - lastTs) / 1000) : 0.016;
  lastTs = now;
  const cx = cssW * 0.5;
  const cy = cssH * 0.5;
  const spd = Math.max(0, Math.min(1, props.speed));

  if (props.active && spd > 0.03) {
    fading.value = false;
    emitBurst(cx, cy, dt);
  } else if (particles.length) {
    // Soft release: brief sparkle fade, not a hard cut
    if (!fading.value) {
      fading.value = true;
      if (particles.length > 48) {
        particles.splice(0, particles.length - 48);
      }
      for (const p of particles) {
        p.life = Math.min(p.life, rand(0.12, 0.28));
        p.maxLife = Math.max(p.maxLife * 0.4, p.life);
        p.vx *= 0.42;
        p.vy *= 0.42;
        p.vx += (Math.random() - 0.5) * 70;
        p.vy += (Math.random() - 0.5) * 70;
      }
    }
  } else {
    fading.value = false;
  }

  const lifeMul = props.active ? 1.15 : 2.2;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!;
    p.life -= dt * lifeMul;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    const age = 1 - p.life / p.maxLife;
    const scatter = age * age;
    p.vx += (Math.random() - 0.5) * 55 * scatter * dt;
    p.vy += ((Math.random() - 0.5) * 55 - 28) * scatter * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= props.active ? 0.955 : 0.88;
    p.vy *= props.active ? 0.955 : 0.88;
  }

  if (particles.length > 180) {
    particles.splice(0, particles.length - 180);
  }

  ctx.clearRect(0, 0, cssW, cssH);

  if (!particles.length && spd < 0.03) {
    raf = requestAnimationFrame(tick);
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawGroundGlow(ctx, cx, cy, spd);
  drawCometHead(ctx, cx, cy, props.active ? spd : spd * 0.28);

  for (const p of particles) {
    const age = 1 - p.life / p.maxLife;
    const dissolve = age < 0.55 ? 1 - age * 0.55 : Math.pow(1 - age, 2.4);
    const alpha = dissolve * (0.38 + (1 - age) * 0.32);
    const size = p.size * (1 - age * 0.72) * (0.85 + dissolve * 0.15);
    const col = colorAt(p, age);
    ctx.globalAlpha = alpha * 0.12;
    ctx.fillStyle = props.palette.glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size * 2.6, 0, Math.PI * 2);
    ctx.fill();
    drawShape(ctx, p.shape, p.x, p.y, size, col, alpha * 0.78);
  }
  ctx.restore();

  raf = requestAnimationFrame(tick);
}

function onResize() {
  resize();
}

onMounted(() => {
  resize();
  window.addEventListener("resize", onResize);
  raf = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", onResize);
  if (raf) cancelAnimationFrame(raf);
  particles = [];
});

watch(
  () => [props.palette.id, props.active] as const,
  () => {
    if (!props.active) return;
    particles = [];
    emitCarry = 0;
  }
);

watch(
  () => props.wormholePhase,
  (phase, prev) => {
    if (phase === prev) return;
    if (phase === "out" || phase === "in") {
      emitWormholeBurst(phase);
    }
  }
);
</script>

<style scoped>
.pet-trail-canvas {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.12s ease-out;
}

.pet-trail-canvas.is-on {
  opacity: 1;
}
</style>
