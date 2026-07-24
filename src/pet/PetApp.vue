<template>
  <div class="pet-root" :style="rootStyle">
    <div
      class="pet-stage"
      :data-model="activeSkin.model"
      :style="stageFlyStyle"
    >
      <PetMeteorTrail
        v-if="trailEnabled"
        :active="isDragging && dragTrailSpeed > 0.04"
        :angle="dragTrailAngle"
        :speed="dragTrailSpeed"
        :palette="trailStyle"
        :wormhole-phase="wormholePhase"
      />
      <div
        class="pet-avatar"
        :data-mood="mood"
        :data-idle="idleMotion"
        :data-physics="physicsActive ? '1' : '0'"
        :data-model="activeSkin.model"
        :data-skin="activeSkin.id"
        :style="chipSkinStyle"
        :title="chipTitle"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @contextmenu.prevent="onContextMenu"
      >
        <i v-show="showHitBounds" class="pet-hit-bounds" aria-hidden="true" />
        <template v-if="activeSkin.model === 'vrm'">
          <template v-if="vrmSrc">
            <i class="vrm-ground-shadow" aria-hidden="true" />
            <PetVrmModel
              class="vrm-host"
              :src="vrmSrc"
              :mood="mood"
              :gaze="gaze"
              :motion="idleMotion"
              :blinking="blinking"
              :lifting="isDragging"
              :face-yaw="vrmFaceYaw"
            />
          </template>
        </template>
        <span
          v-else
          class="chip-bob"
          :key="motionPlayId"
          :style="bobStyle"
        >
          <i
            v-if="activeSkin.model === 'chip'"
            class="chip-ground-shadow"
          />
          <PetChipModel
            v-if="activeSkin.model === 'chip'"
            :visual="v"
            :mood="mood"
            :blinking="blinking"
            :gaze="gaze"
            :pin-colors="pinColors"
          />
          <PetFigSciModel
            v-else-if="activeSkin.model === 'fig-sci'"
            :visual="v"
            :mood="mood"
            :gaze="gaze"
            :motion="idleMotion"
            :fig-art-id="activeSkin.figArtId"
          />
          <PetToonModel
            v-else
            :visual="v"
            :mood="mood"
            :gaze="gaze"
            :motion="idleMotion"
            :decor="activeSkin.toonDecor"
            :wormhole-phase="wormholePhase"
          />
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  cursorPosition,
  getCurrentWindow,
} from "@tauri-apps/api/window";
import { hidePetBubble, showPetBubble, syncPetBubbleToPet } from "./bubbleWindow";
import { requestOpenPetSettings } from "./hostBridge";
import { buildSkinIntro } from "./intro";
import { pickMotionLine, pickPetLine, pickTapEggLine } from "./lines";
import { PetChipModel, PetFigSciModel, PetMeteorTrail, PetToonModel, PetVrmModel } from "./models";
import {
  idleMotionPoolForModel,
  isPetIdleMotion,
  isScreenFlightMotion,
  isVrmWalkMotion,
  motionHoldMs,
  PET_MOTION_EVENT,
  PET_TAP_EGG_MOTIONS,
  resolveMotionForModel,
  type PetIdleMotion,
  type PetMotionPayload,
} from "./motions";
import {
  flyPetWindowRandom,
  teleportPetWindowWormhole,
  walkPetWindowRandom,
} from "./screenFly";
import { loadPetSettings, normalizePetSettings } from "./settings";
import { resolveAppearance, resolveNickname } from "./skins";
import { petBodyBox, petWindowSize } from "./sizes";
import { resolveTrailStyle } from "./trailStyles";
import { resolvePetVrmSrc } from "./vrmStorage";
import {
  PET_INTRO_EVENT,
  PET_SETTINGS_EVENT,
  PET_SETTINGS_KEY,
  type PetMood,
  type PetSettings,
  type PetUsbAnnouncePayload,
} from "./types";
import {
  buildUsbAnnounceText,
  stopPetUsbWatch,
  syncPetUsbWatch,
} from "./usbWatch";

const SLEEP_MS = 3 * 60 * 1000;
const BUBBLE_MS = 4500;
const DRAG_THRESHOLD = 14;
const MAX_GAZE = 2.2;
const MAX_GAZE_TOON = 3.4;
const MAX_GAZE_VRM = 1.8;
const PIN_COUNT = 14;
const TAP_WINDOW_MS = 700;
const TAP_EGG_NEED = 3;

const settings = ref<PetSettings>(loadPetSettings());
const vrmSrc = ref<string | null>(null);
const mood = ref<PetMood>("idle");
const lastLine = ref<string | null>(null);
const blinking = ref(false);
const idleMotion = ref<PetIdleMotion>("idle-float");
const motionPlayId = ref(0);
const speaking = ref(false);
const isDragging = ref(false);
const showHitBounds = ref(false);
const swingAngle = ref(0);
const tiltY = ref(0);
const tiltX = ref(0);
const stretchX = ref(1);
const stretchY = ref(1);
/** 飞屏时窗位 IPC 滞后用 CSS 补帧 */
const flyVisualX = ref(0);
const flyVisualY = ref(0);
const vrmFaceYaw = ref(0);
const wormholePhase = ref<"idle" | "out" | "warp" | "in">("idle");
const gaze = reactive({ x: 0, y: 0 });
const dragTrailAngle = ref(0);
const dragTrailSpeed = ref(0);
const pinColors = ref<string[]>(
  Array.from({ length: PIN_COUNT }, () => "#1a6b78")
);

const activeSkin = computed(() =>
  resolveAppearance(settings.value.modelKind, settings.value.themeId)
);
const displayName = computed(() =>
  resolveNickname(settings.value.nickname, activeSkin.value)
);
const v = computed(() => activeSkin.value.visual);
const winSize = computed(() =>
  petWindowSize(activeSkin.value.model, settings.value.zoomPercent)
);
const bodyBox = computed(() =>
  petBodyBox(activeSkin.value.model, settings.value.zoomPercent)
);

const chipTitle = computed(() => {
  const toneTag = settings.value.tone === "snarky" ? " · snarky" : "";
  return `${displayName.value}${toneTag}`;
});

const chipSkinStyle = computed(() => {
  const vis = v.value;
  return {
    "--pet-accent": vis.accent,
    "--pet-accent-soft": vis.accentSoft,
    "--pet-side-hi": vis.sideHi,
    "--pet-side-mid": vis.sideMid,
    "--pet-side-lo": vis.sideLo,
    "--pet-back-grid": vis.backGrid,
    "--pet-package-stroke": vis.packageStroke,
    "--pet-die-from": vis.dieFrom,
    "--pet-die-to": vis.dieTo,
    "--pet-body": `${bodyBox.value.h}px`,
    "--pet-body-w": `${bodyBox.value.w}px`,
    "--pet-body-h": `${bodyBox.value.h}px`,
  } as Record<string, string>;
});

/** opacity<1 会压扁 3D，尽量只在必要时挂到 root */
const rootStyle = computed(() =>
  settings.value.opacity < 0.995 ? { opacity: settings.value.opacity } : {}
);

const stageFlyStyle = computed(() => {
  const x = flyVisualX.value;
  const y = flyVisualY.value;
  if (Math.abs(x) < 0.15 && Math.abs(y) < 0.15) return {};
  return {
    transform: `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`,
    willChange: "transform",
  } as Record<string, string>;
});

const trailEnabled = computed(() => activeSkin.value.model === "toon");

const trailStyle = computed(() =>
  resolveTrailStyle({
    themeId: activeSkin.value.themeId,
    model: activeSkin.value.model,
    toonDecor: activeSkin.value.toonDecor,
  })
);

const physicsActive = computed(
  () =>
    isDragging.value ||
    Math.abs(swingAngle.value) > 0.35 ||
    Math.abs(tiltY.value) > 0.6 ||
    Math.abs(tiltX.value) > 0.6 ||
    Math.abs(stretchX.value - 1) > 0.012 ||
    Math.abs(stretchY.value - 1) > 0.012
);

const bobStyle = computed(() => {
  if (activeSkin.value.model === "vrm") return {};
  if (!physicsActive.value) return {};
  return {
    animation: "none",
    transform: `rotateY(${tiltY.value}deg) rotateX(${tiltX.value}deg) rotateZ(${swingAngle.value}deg) scale(${stretchX.value}, ${stretchY.value})`,
    transformOrigin: "50% 55%",
  };
});

let bubbleTimer: number | null = null;
let sleepTimer: number | null = null;
let moodResetTimer: number | null = null;
let blinkTimer: number | null = null;
let idleActionTimer: number | null = null;
let idleHoldTimer: number | null = null;
let autoSpeakTimer: number | null = null;
let unlistenSettings: UnlistenFn | null = null;
let unlistenMotion: UnlistenFn | null = null;
let unlistenIntro: UnlistenFn | null = null;
let rafId = 0;
let motionLockUntil = 0;
let motionGen = 0;

let pointerDown = false;
let dragStarted = false;
let downScreen = { x: 0, y: 0 };
let lastCursorLog = { x: 0, y: 0 };
let grabOffsetX = 0;
let grabOffsetY = 0;
let smoothVelX = 0;
let smoothVelY = 0;
let swingVel = 0;
let tiltYVel = 0;
let tiltXVel = 0;
let stretchVelX = 0;
let stretchVelY = 0;
let lastTick = 0;
let frame = 0;
let cachedScale = 1;
let winCenter = { x: 0, y: 0 };
let wantPos: { x: number; y: number } | null = null;
let posWriting = false;
let ignoreCursor = false;
const HIT_PAD = 2;

async function syncCursorPassThrough(overPet: boolean) {
  const shouldIgnore = !overPet && !isDragging.value;
  if (shouldIgnore === ignoreCursor) return;
  ignoreCursor = shouldIgnore;
  try {
    await getCurrentWindow().setIgnoreCursorEvents(shouldIgnore);
  } catch {
    // ignore
  }
}

function clearTimer(id: number | null) {
  if (id != null) window.clearTimeout(id);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hsl(h: number, s: number, l: number) {
  return `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`;
}

function tickLeds(now: number) {
  const phase = now / 150;
  const breath = 0.5 + 0.5 * Math.sin(now / 620);
  const snarky = settings.value.tone === "snarky";
  const baseHue = snarky ? 22 : activeSkin.value.visual.ledHue;
  const next = new Array<string>(PIN_COUNT);
  for (let i = 0; i < PIN_COUNT; i++) {
    let dist = Math.abs(i - (phase % PIN_COUNT));
    dist = Math.min(dist, PIN_COUNT - dist);
    const chase = Math.exp(-dist * dist * 0.5);
    const t = clamp(chase * 0.95 + breath * 0.22, 0, 1);
    const hue = baseHue + i * 5 + phase * 7 + t * 28;
    next[i] = hsl(hue, 70 + t * 25, 28 + t * 42);
  }
  pinColors.value = next;
}

function applyMoodForMotion(motion: PetIdleMotion) {
  if (speaking.value || isDragging.value || mood.value === "sleep") return;
  switch (motion) {
    case "happy-bounce":
    case "victory-burst":
    case "rocket-jump":
    case "cartwheel":
    case "tap-frenzy":
    case "toon-wave":
    case "toon-tilt":
    case "toon-tea":
    case "toon-water":
    case "toon-grass":
    case "toon-splash":
      mood.value = "happy";
      break;
    case "toon-fire":
    case "toon-thunder":
    case "screen-wormhole":
      mood.value = "excited";
      break;
    case "toon-dodge":
    case "toon-spin":
      mood.value = "curious";
      break;
    case "fly-orbit":
    case "fly-dash":
    case "barrel-roll":
    case "figure-eight":
    case "screen-dash":
    case "screen-hop":
    case "screen-glide":
    case "screen-zip":
    case "toon-walk":
    case "vrm-walk":
      mood.value = "excited";
      break;
    case "peekaboo":
    case "toon-read":
      mood.value = "curious";
      break;
    case "sway-step":
    case "side-hop":
    case "bow-nod":
    case "tip-toe":
    case "stretch-up":
      mood.value = "happy";
      break;
    default:
      mood.value = "idle";
  }
}

function isMotionLocked() {
  return Date.now() < motionLockUntil;
}

let flySignal: { cancelled: boolean } | null = null;
let tapTimes: number[] = [];

function beginMotion(
  motion: PetIdleMotion,
  options: { manual?: boolean; withSpeakChance?: number } = {}
) {
  const manual = Boolean(options.manual);
  const gen = ++motionGen;
  clearTimer(idleHoldTimer);
  if (manual) {
    clearTimer(idleActionTimer);
  }
  if (flySignal) flySignal.cancelled = true;
  flySignal = { cancelled: false };
  const flight = flySignal;
  flyVisualX.value = 0;
  flyVisualY.value = 0;

  const resolved = resolveMotionForModel(motion, activeSkin.value.model);
  if (!isVrmWalkMotion(resolved)) {
    vrmFaceYaw.value = 0;
  }
  const hold = motionHoldMs(resolved);
  motionLockUntil = Date.now() + hold + (manual ? 900 : 250);
  motionPlayId.value += 1;
  idleMotion.value = resolved;
  applyMoodForMotion(resolved);

  if (isVrmWalkMotion(resolved) && !isDragging.value) {
    void walkPetWindowRandom(
      winSize.value.w,
      winSize.value.h,
      flight,
      (info) => {
        flyVisualX.value = info.visualDx;
        flyVisualY.value = info.visualDy;
        const target = info.dirX >= 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
        vrmFaceYaw.value += (target - vrmFaceYaw.value) * 0.28;
        if (speaking.value) void syncPetBubbleToPet();
      }
    ).finally(() => {
      if (!flight.cancelled) {
        flyVisualX.value = 0;
        flyVisualY.value = 0;
        vrmFaceYaw.value = 0;
      }
      if (gen === motionGen && !isDragging.value && mood.value !== "sleep") {
        idleMotion.value = "idle-float";
        if (!speaking.value) mood.value = "idle";
      }
      if (gen === motionGen) {
        motionLockUntil = 0;
        if (manual) scheduleIdleAction();
      }
    });
  } else if (isScreenFlightMotion(resolved) && !isDragging.value) {
    if (activeSkin.value.model === "toon") {
      wormholePhase.value = "out";
      void teleportPetWindowWormhole(
        winSize.value.w,
        winSize.value.h,
        flight,
        (phase) => {
          if (phase === "done") {
            wormholePhase.value = "idle";
          } else {
            wormholePhase.value = phase;
          }
          if (speaking.value) void syncPetBubbleToPet();
        }
      ).finally(() => {
        if (!flight.cancelled) wormholePhase.value = "idle";
      });
    } else if (activeSkin.value.model !== "vrm") {
      const dur =
        resolved === "screen-zip"
          ? 900
          : resolved === "screen-dash"
            ? 1200
            : resolved === "screen-hop"
              ? 1500
              : 1900;
      void flyPetWindowRandom(
        winSize.value.w,
        winSize.value.h,
        dur,
        flight,
        (info) => {
          flyVisualX.value = info.visualDx;
          flyVisualY.value = info.visualDy;
          if (speaking.value) void syncPetBubbleToPet();
        }
      ).finally(() => {
        if (!flight.cancelled) {
          flyVisualX.value = 0;
          flyVisualY.value = 0;
        }
      });
    }
  }

  const speakChance = options.withSpeakChance ?? 0;
  if (speakChance > 0 && Math.random() < speakChance) {
    window.setTimeout(() => {
      if (gen !== motionGen) return;
      if (isDragging.value || mood.value === "sleep") return;
      const line = pickMotionLine(
        resolved,
        settings.value.tone,
        settings.value.personality,
        activeSkin.value.model
      );
      void speakText(line, true, { keepMotion: true });
    }, 280);
  }

  idleHoldTimer = window.setTimeout(() => {
    if (gen !== motionGen) return;
    if (isVrmWalkMotion(resolved)) return;
    if (!isDragging.value && mood.value !== "sleep") {
      idleMotion.value = "idle-float";
      if (!speaking.value) mood.value = "idle";
    }
    if (manual) {
      motionLockUntil = 0;
      scheduleIdleAction();
    }
  }, hold);
}

function playMotionOnce(motion: PetIdleMotion) {
  if (isDragging.value) return;
  if (mood.value === "sleep") mood.value = "idle";
  speaking.value = false;
  void hidePetBubble();
  clearTimer(moodResetTimer);
  beginMotion(motion, { manual: true, withSpeakChance: 0.85 });
  resetSleepTimer();
}

function resetSleepTimer() {
  clearTimer(sleepTimer);
  if (mood.value === "sleep") mood.value = "idle";
  sleepTimer = window.setTimeout(() => {
    void hidePetBubble();
    speaking.value = false;
    mood.value = "sleep";
    idleMotion.value = "idle-float";
    motionGen += 1;
    motionLockUntil = 0;
    clearTimer(idleHoldTimer);
    clearTimer(idleActionTimer);
  }, SLEEP_MS);
}

function playClickSound() {
  if (settings.value.muted) return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = settings.value.tone === "snarky" ? 240 : 520;
    gain.gain.value = 0.025;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
    osc.stop(ctx.currentTime + 0.11);
    window.setTimeout(() => void ctx.close(), 180);
  } catch {
    // ignore
  }
}

async function speakText(
  line: string,
  fromAuto = false,
  options: { keepMotion?: boolean; force?: boolean } = {}
) {
  if (!line) return;
  if (speaking.value && fromAuto && !options.force) return;
  if (isDragging.value && !options.force) return;
  if (fromAuto && isMotionLocked() && !options.keepMotion && !options.force) return;

  lastLine.value = line;
  speaking.value = true;
  mood.value = settings.value.tone === "snarky" ? "grumpy" : "happy";
  if (!options.keepMotion && !isMotionLocked()) {
    idleMotion.value = "happy-bounce";
  }

  const durationMs = Math.max(BUBBLE_MS, 1200 + line.length * 42);
  try {
    await showPetBubble({
      text: line,
      tone: settings.value.tone,
      durationMs,
    });
  } catch (err) {
    console.warn("[pet] bubble failed", err);
  }

  clearTimer(bubbleTimer);
  bubbleTimer = window.setTimeout(() => {
    speaking.value = false;
  }, durationMs);

  clearTimer(moodResetTimer);
  moodResetTimer = window.setTimeout(() => {
    if (mood.value !== "sleep" && !isDragging.value && !isMotionLocked()) {
      mood.value = "idle";
      if (!options.keepMotion) idleMotion.value = "idle-float";
    }
  }, 1600);

  if (!fromAuto) playClickSound();
  resetSleepTimer();
  scheduleAutoSpeak();
}

async function speak(
  fromAuto = false,
  options: { keepMotion?: boolean } = {}
) {
  const line = pickPetLine(
    settings.value.tone,
    lastLine.value,
    settings.value.personality,
    activeSkin.value.model
  );
  await speakText(line, fromAuto, options);
}

function speakIntro() {
  const line = buildSkinIntro(settings.value);
  void speakText(line, false);
}

async function openPetSettingsPage() {
  await requestOpenPetSettings();
}

function onContextMenu() {
  void openPetSettingsPage();
}

function triggerTapEgg() {
  const model = activeSkin.value.model;
  const pool = PET_TAP_EGG_MOTIONS.filter((m) => {
    const r = resolveMotionForModel(m, model);
    return r === m || isScreenFlightMotion(r) || r.startsWith("toon") || r === "tap-frenzy" || r === "victory-burst" || r === "peekaboo";
  });
  const pick =
    pool[Math.floor(Math.random() * pool.length)] ??
    (model === "chip" ? "screen-zip" : "tap-frenzy");
  beginMotion(pick, { manual: true });
  const line = pickTapEggLine(model, settings.value.personality);
  void speakText(line, false, { force: true, keepMotion: true });
}

function registerTapForEgg() {
  const now = Date.now();
  tapTimes = tapTimes.filter((t) => now - t < TAP_WINDOW_MS);
  tapTimes.push(now);
  if (tapTimes.length >= TAP_EGG_NEED) {
    tapTimes = [];
    triggerTapEgg();
    return true;
  }
  return false;
}

function onUsbAnnounce(payload: PetUsbAnnouncePayload) {
  if (!settings.value.usbWatchEnabled) return;
  if (mood.value === "sleep") mood.value = "idle";
  const lang =
    (localStorage.getItem("language") || "zh").toLowerCase().startsWith("zh")
      ? "zh"
      : "en";
  const text = buildUsbAnnounceText(payload, lang);
  void speakText(text, false, { force: true });
}

function refreshUsbWatch() {
  syncPetUsbWatch(settings.value.usbWatchEnabled, onUsbAnnounce);
}

async function refreshVrmSrc() {
  if (!settings.value.vrmModelName) {
    vrmSrc.value = null;
    return;
  }
  vrmSrc.value = await resolvePetVrmSrc(settings.value.vrmModelRev);
}

function applySettings(
  next: PetSettings | Partial<PetSettings>,
  options?: { introIfSkinChanged?: boolean }
) {
  const prevId = activeSkin.value.id;
  const prevModel = activeSkin.value.model;
  const prevZoom = settings.value.zoomPercent;
  const prevUsb = settings.value.usbWatchEnabled;
  const prevRandomIdle = settings.value.randomIdleEnabled;
  const prevVrmName = settings.value.vrmModelName;
  const prevVrmRev = settings.value.vrmModelRev;
  settings.value = normalizePetSettings(next);
  const nextLook = resolveAppearance(
    settings.value.modelKind,
    settings.value.themeId
  );
  if (options?.introIfSkinChanged && nextLook.id !== prevId) {
    speakIntro();
  }
  if (settings.value.usbWatchEnabled !== prevUsb) {
    refreshUsbWatch();
  }
  if (settings.value.randomIdleEnabled !== prevRandomIdle) {
    if (settings.value.randomIdleEnabled) {
      scheduleIdleAction();
    } else {
      clearTimer(idleActionTimer);
      idleActionTimer = null;
    }
  }
  if (
    settings.value.vrmModelName !== prevVrmName ||
    settings.value.vrmModelRev !== prevVrmRev
  ) {
    void refreshVrmSrc();
  }
  if (
    nextLook.model !== prevModel ||
    settings.value.zoomPercent !== prevZoom
  ) {
    void resizePetWindow();
  }
}

async function resizePetWindow() {
  try {
    const win = getCurrentWindow();
    const size = winSize.value;
    await win.setSize(new LogicalSize(size.w, size.h));
    const scale = await win.scaleFactor();
    const outer = (await win.outerPosition()).toLogical(scale);
    winCenter = {
      x: outer.x + size.w / 2,
      y: outer.y + size.h / 2,
    };
    if (speaking.value) void syncPetBubbleToPet();
  } catch {
    // ignore
  }
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  e.preventDefault();
  pointerDown = true;
  dragStarted = false;
  downScreen = { x: e.screenX, y: e.screenY };
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    // ignore
  }
}

async function beginPhysicsDrag() {
  if (dragStarted || isDragging.value) return;
  dragStarted = true;

  try {
    const win = getCurrentWindow();
    cachedScale = await win.scaleFactor();
    const outer = (await win.outerPosition()).toLogical(cachedScale);
    const cursor = (await cursorPosition()).toLogical(cachedScale);

    if (!pointerDown || !dragStarted) {
      dragStarted = false;
      return;
    }

    grabOffsetX = cursor.x - outer.x;
    grabOffsetY = cursor.y - outer.y;
    lastCursorLog = { x: cursor.x, y: cursor.y };
    smoothVelX = 0;
    smoothVelY = 0;
    wantPos = null;

    if (flySignal) flySignal.cancelled = true;
    flySignal = null;
    flyVisualX.value = 0;
    flyVisualY.value = 0;
    vrmFaceYaw.value = 0;
    wormholePhase.value = "idle";

    winCenter = {
      x: outer.x + winSize.value.w / 2,
      y: outer.y + winSize.value.h / 2,
    };

    mood.value = "curious";
    speaking.value = false;
    void hidePetBubble();
    idleMotion.value = "idle-float";
    motionGen += 1;
    motionLockUntil = 0;
    clearTimer(idleHoldTimer);
    clearTimer(idleActionTimer);

    isDragging.value = true;
  } catch {
    dragStarted = false;
  }
}

function onPointerMove(e: PointerEvent) {
  if (!pointerDown || dragStarted) return;
  const dist = Math.hypot(e.screenX - downScreen.x, e.screenY - downScreen.y);
  if (dist >= DRAG_THRESHOLD) {
    void beginPhysicsDrag();
  }
}

function onPointerUp(e: PointerEvent) {
  if (!pointerDown) return;
  pointerDown = false;

  const dist = Math.hypot(e.screenX - downScreen.x, e.screenY - downScreen.y);
  const wasDragging = dragStarted || isDragging.value;

  if (isDragging.value) {
    isDragging.value = false;
    swingVel = smoothVelX * 3.2;
    tiltYVel = smoothVelX * 0.7;
    tiltXVel = -smoothVelY * 0.5;
    stretchVelX = (1 - stretchX.value) * 8;
    stretchVelY = (1 - stretchY.value) * 8;
    window.setTimeout(() => {
      if (!isDragging.value && !speaking.value && mood.value !== "sleep") {
        mood.value = "idle";
      }
    }, 320);
    scheduleIdleAction();
  }

  dragStarted = false;
  wantPos = null;

  if (!wasDragging && dist < DRAG_THRESHOLD) {
    if (registerTapForEgg()) {
    } else {
      void speak(false);
    }
  }

  resetSleepTimer();
}

async function pumpWindowPos() {
  if (posWriting) return;
  posWriting = true;
  try {
    const win = getCurrentWindow();
    while (wantPos && isDragging.value) {
      const p = wantPos;
      wantPos = null;
      try {
        await win.setPosition(new LogicalPosition(p.x, p.y));
        winCenter = {
          x: p.x + winSize.value.w / 2,
          y: p.y + winSize.value.h / 2,
        };
      } catch {
        break;
      }
    }
  } finally {
    posWriting = false;
    if (wantPos && isDragging.value) void pumpWindowPos();
  }
}

function tickSwing(dt: number) {
  if (isDragging.value) {
    const speed = Math.hypot(smoothVelX, smoothVelY);
    const targetSwing = clamp(smoothVelX * 4.2, -28, 28);
    swingAngle.value += (targetSwing - swingAngle.value) * Math.min(1, dt * 16);

    const targetTiltY = clamp(smoothVelX * 2.4, -22, 22);
    const targetTiltX = clamp(-smoothVelY * 1.8, -14, 14);
    tiltY.value += (targetTiltY - tiltY.value) * Math.min(1, dt * 14);
    tiltX.value += (targetTiltX - tiltX.value) * Math.min(1, dt * 14);

    const pull = clamp(speed * 0.01, 0, 0.12);
    const tx = clamp(1 - pull * 0.35, 0.9, 1.03);
    const ty = clamp(1 + pull * 0.45, 0.97, 1.12);
    stretchX.value += (tx - stretchX.value) * Math.min(1, dt * 14);
    stretchY.value += (ty - stretchY.value) * Math.min(1, dt * 14);

    const targetSpeed = clamp(speed / 12, 0, 1);
    dragTrailSpeed.value +=
      (targetSpeed - dragTrailSpeed.value) * Math.min(1, dt * 14);
    if (speed > 0.4) {
      const ang = (Math.atan2(smoothVelY, smoothVelX) * 180) / Math.PI + 180;
      const prev = dragTrailAngle.value;
      let delta = ang - prev;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      dragTrailAngle.value = prev + delta * Math.min(1, dt * 14);
    }
    return;
  }

  dragTrailSpeed.value *= Math.max(0, 1 - dt * 11);
  if (dragTrailSpeed.value < 0.025) dragTrailSpeed.value = 0;

  smoothVelX = 0;
  smoothVelY = 0;

  swingVel += (-90 * swingAngle.value - 14 * swingVel) * dt;
  swingAngle.value += swingVel * dt;
  tiltYVel += (-85 * tiltY.value - 13 * tiltYVel) * dt;
  tiltY.value += tiltYVel * dt;
  tiltXVel += (-85 * tiltX.value - 13 * tiltXVel) * dt;
  tiltX.value += tiltXVel * dt;
  stretchVelX += (-70 * (stretchX.value - 1) - 12 * stretchVelX) * dt;
  stretchX.value += stretchVelX * dt;
  stretchVelY += (-70 * (stretchY.value - 1) - 12 * stretchVelY) * dt;
  stretchY.value += stretchVelY * dt;

  if (
    Math.abs(swingAngle.value) < 0.15 &&
    Math.abs(swingVel) < 0.15 &&
    Math.abs(tiltY.value) < 0.2 &&
    Math.abs(tiltX.value) < 0.2 &&
    Math.abs(tiltYVel) < 0.15 &&
    Math.abs(tiltXVel) < 0.15 &&
    Math.abs(stretchX.value - 1) < 0.008 &&
    Math.abs(stretchY.value - 1) < 0.008
  ) {
    swingAngle.value = 0;
    swingVel = 0;
    tiltY.value = 0;
    tiltX.value = 0;
    tiltYVel = 0;
    tiltXVel = 0;
    stretchX.value = 1;
    stretchY.value = 1;
    stretchVelX = 0;
    stretchVelY = 0;
  }
}

async function sampleCursor() {
  try {
    const scale = cachedScale || (await getCurrentWindow().scaleFactor());
    cachedScale = scale;
    const cursor = (await cursorPosition()).toLogical(scale);

    if (isDragging.value) {
      const dx = cursor.x - lastCursorLog.x;
      const dy = cursor.y - lastCursorLog.y;
      smoothVelX += (dx - smoothVelX) * 0.55;
      smoothVelY += (dy - smoothVelY) * 0.55;
      wantPos = {
        x: cursor.x - grabOffsetX,
        y: cursor.y - grabOffsetY,
      };
      void pumpWindowPos();
      if (speaking.value) void syncPetBubbleToPet();
    }

    lastCursorLog = { x: cursor.x, y: cursor.y };

    if (isDragging.value || frame % 6 === 0) {
      const outer = (
        await getCurrentWindow().outerPosition()
      ).toLogical(scale);
      winCenter = {
        x: outer.x + winSize.value.w / 2,
        y: outer.y + winSize.value.h / 2,
      };
    }

    const halfW = bodyBox.value.w / 2 + HIT_PAD;
    const halfH = bodyBox.value.h / 2 + HIT_PAD;
    const overPet =
      isDragging.value ||
      (Math.abs(cursor.x - winCenter.x) <= halfW &&
        Math.abs(cursor.y - winCenter.y) <= halfH);
    showHitBounds.value =
      settings.value.hitBoundsEnabled && overPet && !isDragging.value;
    void syncCursorPassThrough(overPet);

    if (mood.value !== "sleep") {
      const gdx = cursor.x - winCenter.x;
      const gdy = cursor.y - winCenter.y;
      const len = Math.hypot(gdx, gdy) || 1;
      const maxGaze =
        activeSkin.value.model === "vrm"
          ? MAX_GAZE_VRM
          : activeSkin.value.model === "toon"
            ? MAX_GAZE_TOON
            : MAX_GAZE;
      const strength = clamp(
        len / (activeSkin.value.model === "vrm" ? 90 : activeSkin.value.model === "toon" ? 120 : 160),
        0,
        1
      );
      const follow =
        activeSkin.value.model === "vrm"
          ? 0.55
          : activeSkin.value.model === "toon"
            ? 0.42
            : 0.32;
      gaze.x += ((gdx / len) * maxGaze * strength - gaze.x) * follow;
      gaze.y += ((gdy / len) * maxGaze * strength - gaze.y) * follow;
    } else {
      gaze.x *= 0.85;
      gaze.y *= 0.85;
    }
  } catch {
    // ignore
  }
}

function loop(now: number) {
  const dt = lastTick ? clamp((now - lastTick) / 1000, 0.001, 0.04) : 0.016;
  lastTick = now;
  frame += 1;

  if (activeSkin.value.model === "chip") {
    tickLeds(now);
  }
  tickSwing(dt);

  // VRM 也隔帧采样，降低 cursorPosition IPC
  if (isDragging.value || frame % 2 === 0) {
    void sampleCursor();
  }

  rafId = window.requestAnimationFrame(loop);
}

function scheduleBlink() {
  clearTimer(blinkTimer);
  blinkTimer = window.setTimeout(() => {
    if (mood.value === "sleep" || isDragging.value) {
      scheduleBlink();
      return;
    }
    blinking.value = true;
    window.setTimeout(() => {
      blinking.value = false;
    }, 100);
    scheduleBlink();
  }, 2000 + Math.random() * 2800);
}

function scheduleIdleAction() {
  clearTimer(idleActionTimer);
  if (!settings.value.randomIdleEnabled) {
    idleActionTimer = null;
    return;
  }
  idleActionTimer = window.setTimeout(() => {
    if (!settings.value.randomIdleEnabled) {
      idleActionTimer = null;
      return;
    }
    if (
      mood.value === "sleep" ||
      speaking.value ||
      isDragging.value ||
      isMotionLocked()
    ) {
      scheduleIdleAction();
      return;
    }
    const pool = idleMotionPoolForModel(activeSkin.value.model);
    const next = pool[Math.floor(Math.random() * pool.length)]!;
    beginMotion(next, { withSpeakChance: 0.55 });
    const hold = motionHoldMs(next);
    idleActionTimer = window.setTimeout(() => {
      scheduleIdleAction();
    }, hold + 2600 + Math.random() * 4000);
  }, 3800 + Math.random() * 4200);
}

function scheduleAutoSpeak() {
  clearTimer(autoSpeakTimer);
  autoSpeakTimer = window.setTimeout(() => {
    if (mood.value === "sleep" || speaking.value || isDragging.value) {
      scheduleAutoSpeak();
      return;
    }
    void speak(true);
  }, 45000 + Math.random() * 50000);
}

onMounted(async () => {
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";

  try {
    const win = getCurrentWindow();
    await win.setSize(new LogicalSize(winSize.value.w, winSize.value.h));
    cachedScale = await win.scaleFactor();
    const outer = (await win.outerPosition()).toLogical(cachedScale);
    winCenter = {
      x: outer.x + winSize.value.w / 2,
      y: outer.y + winSize.value.h / 2,
    };
    const cursor = (await cursorPosition()).toLogical(cachedScale);
    lastCursorLog = { x: cursor.x, y: cursor.y };
  } catch {
    // ignore
  }

  lastTick = 0;
  rafId = window.requestAnimationFrame(loop);
  resetSleepTimer();
  scheduleBlink();
  scheduleIdleAction();
  scheduleAutoSpeak();
  void refreshVrmSrc();

  unlistenSettings = await listen<PetSettings>(PET_SETTINGS_EVENT, (event) => {
    applySettings(event.payload, { introIfSkinChanged: true });
  });
  unlistenMotion = await listen<PetMotionPayload>(PET_MOTION_EVENT, (event) => {
    const motion = event.payload?.motion;
    if (!isPetIdleMotion(motion) || motion === "idle-float") return;
    playMotionOnce(motion);
  });
  unlistenIntro = await listen(PET_INTRO_EVENT, () => {
    applySettings(loadPetSettings(), { introIfSkinChanged: false });
    speakIntro();
  });
  refreshUsbWatch();
  window.addEventListener("storage", onStorage);
});

function onStorage(ev: StorageEvent) {
  if (ev.key !== PET_SETTINGS_KEY || !ev.newValue) return;
  try {
    applySettings(JSON.parse(ev.newValue) as Partial<PetSettings>, {
      introIfSkinChanged: true,
    });
  } catch {
    // ignore
  }
}

onUnmounted(() => {
  if (flySignal) flySignal.cancelled = true;
  clearTimer(bubbleTimer);
  clearTimer(sleepTimer);
  clearTimer(moodResetTimer);
  clearTimer(blinkTimer);
  clearTimer(idleActionTimer);
  clearTimer(idleHoldTimer);
  clearTimer(autoSpeakTimer);
  if (rafId) window.cancelAnimationFrame(rafId);
  unlistenSettings?.();
  unlistenMotion?.();
  unlistenIntro?.();
  stopPetUsbWatch();
  window.removeEventListener("storage", onStorage);
  void hidePetBubble();
  showHitBounds.value = false;
  if (ignoreCursor) {
    ignoreCursor = false;
    void getCurrentWindow().setIgnoreCursorEvents(false);
  }
});
</script>

<style scoped>
.pet-root {
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  background: transparent;
  overflow: visible;
  user-select: none;
  touch-action: none;
  pointer-events: none;
}

.pet-root:active {
  cursor: grabbing;
}

.pet-stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 720px;
  perspective-origin: 50% 40%;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  pointer-events: none;
  overflow: visible;
}

.pet-stage[data-model="vrm"] {
  perspective: none;
  transform-style: flat;
  backface-visibility: visible;
}

.pet-avatar {
  position: relative;
  z-index: 1;
  width: var(--pet-body-w, var(--pet-body, 108px));
  height: var(--pet-body-h, var(--pet-body, 108px));
  flex-shrink: 0;
  transform-style: preserve-3d;
  pointer-events: auto;
  cursor: grab;
}

.pet-hit-bounds {
  position: absolute;
  inset: 0;
  z-index: 0;
  box-sizing: border-box;
  border: 1px solid rgba(120, 120, 120, 0.55);
  background: rgba(128, 128, 128, 0.28);
  border-radius: 4px;
  pointer-events: none;
}

.pet-avatar:active {
  cursor: grabbing;
}

.pet-avatar[data-model="vrm"] {
  transform-style: flat;
  overflow: visible;
}

.vrm-host {
  display: block;
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.vrm-ground-shadow {
  position: absolute;
  left: 22%;
  right: 22%;
  bottom: 3%;
  height: 14px;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0.45) 0%,
    rgba(0, 0, 0, 0.18) 42%,
    transparent 72%
  );
  pointer-events: none;
  z-index: 0;
  filter: blur(0.5px);
}

.chip-bob {
  display: block;
  position: relative;
  width: 100%;
  height: 100%;
  transform-origin: 50% 55%;
  transform-style: preserve-3d;
  will-change: transform;
  backface-visibility: hidden;
}

.chip-ground-shadow {
  position: absolute;
  left: 18%;
  right: 18%;
  bottom: 2%;
  height: 14px;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0.55) 0%,
    rgba(0, 0, 0, 0) 72%
  );
  transform: translateZ(-28px) rotateX(80deg);
  pointer-events: none;
  z-index: 0;
}

.pet-avatar[data-model="chip"][data-physics="0"][data-idle="idle-float"] .chip-bob {
  animation: idle-float 3.8s ease-in-out infinite;
}

.pet-avatar[data-model="chip"][data-physics="0"][data-idle="happy-bounce"] .chip-bob {
  animation: happy-bounce 0.55s ease-out;
}

.pet-avatar[data-model="chip"][data-physics="0"][data-idle="fly-orbit"] .chip-bob {
  animation: fly-orbit 3.2s linear both;
}

.pet-avatar[data-model="chip"][data-physics="0"][data-idle="fly-dash"] .chip-bob {
  animation: fly-dash 2.8s cubic-bezier(0.37, 0.01, 0.2, 1) both;
}

.pet-avatar[data-model="chip"][data-physics="0"][data-idle="barrel-roll"] .chip-bob {
  animation: barrel-roll 2.6s linear both;
}

.pet-avatar[data-model="chip"][data-physics="0"][data-idle="rocket-jump"] .chip-bob {
  animation: rocket-jump 2.3s cubic-bezier(0.22, 0.85, 0.28, 1) both;
}

.pet-avatar[data-model="chip"][data-physics="0"][data-idle="cartwheel"] .chip-bob {
  animation: cartwheel 2.5s linear both;
}

.pet-avatar[data-model="chip"][data-physics="0"][data-idle="figure-eight"] .chip-bob {
  animation: figure-eight 3.4s linear both;
}

.pet-avatar[data-model="chip"][data-physics="0"][data-idle="victory-burst"] .chip-bob {
  animation: victory-burst 2.2s cubic-bezier(0.34, 1.15, 0.64, 1) both;
}

.pet-avatar[data-model="chip"][data-physics="0"][data-idle="peekaboo"] .chip-bob {
  animation: peekaboo 2.3s cubic-bezier(0.4, 0.05, 0.2, 1) both;
}

.pet-avatar[data-physics="0"][data-idle="screen-dash"] .chip-bob,
.pet-avatar[data-physics="0"][data-idle="screen-zip"] .chip-bob {
  animation: screen-lean 0.95s cubic-bezier(0.33, 0.1, 0.2, 1) both;
}

.pet-avatar[data-physics="0"][data-idle="screen-hop"] .chip-bob {
  animation: rocket-jump 1.5s cubic-bezier(0.22, 0.85, 0.28, 1) both;
}

.pet-avatar[data-physics="0"][data-idle="screen-glide"] .chip-bob {
  animation: screen-glide-bob 1.9s cubic-bezier(0.4, 0.05, 0.2, 1) both;
}

.pet-avatar[data-physics="0"][data-idle="tap-frenzy"] .chip-bob {
  animation: tap-frenzy 1.8s cubic-bezier(0.34, 1.3, 0.64, 1) both;
}

.pet-avatar[data-model="chip"][data-physics="0"][data-mood="sleep"] .chip-bob {
  animation: breathe 3.2s ease-in-out infinite;
}

@keyframes screen-lean {
  0% {
    transform: translate3d(0, 0, 0) rotateZ(0) scale(1);
  }
  30% {
    transform: translate3d(0, -8px, 12px) rotateZ(-12deg) scale(1.06);
  }
  70% {
    transform: translate3d(0, -4px, 8px) rotateZ(10deg) scale(1.04);
  }
  100% {
    transform: translate3d(0, 0, 0) rotateZ(0) scale(1);
  }
}

@keyframes screen-glide-bob {
  0%,
  100% {
    transform: translateY(0) rotateZ(0) scale(1);
  }
  25% {
    transform: translateY(-10px) rotateZ(-6deg) scale(1.03);
  }
  50% {
    transform: translateY(-4px) rotateZ(4deg) scale(1.01);
  }
  75% {
    transform: translateY(-12px) rotateZ(-3deg) scale(1.04);
  }
}

@keyframes tap-frenzy {
  0%,
  100% {
    transform: translateY(0) rotateZ(0) scale(1);
  }
  12% {
    transform: translateY(-16px) rotateZ(-10deg) scale(1.08);
  }
  24% {
    transform: translateY(2px) rotateZ(12deg) scale(0.94);
  }
  36% {
    transform: translateY(-20px) rotateZ(-8deg) scale(1.1);
  }
  48% {
    transform: translateY(0) rotateZ(14deg) scale(0.96);
  }
  60% {
    transform: translateY(-14px) rotateZ(-12deg) scale(1.06);
  }
  80% {
    transform: translateY(-6px) rotateZ(6deg) scale(1.02);
  }
}

@keyframes idle-float {
  0%,
  100% {
    transform: translateY(0) rotateZ(-2deg);
  }
  50% {
    transform: translateY(-6px) rotateZ(2deg);
  }
}

@keyframes happy-bounce {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  40% {
    transform: translateY(-14px) scale(0.94, 1.06);
  }
  70% {
    transform: translateY(0) scale(1.05, 0.95);
  }
}

@keyframes fly-orbit {
  0% {
    transform: translate3d(0, 12px, 0) scale(1.04) rotateY(0deg) rotateX(4deg) rotateZ(-5deg);
  }
  6.25% {
    transform: translate3d(15px, 9px, -8px) scale(1.01) rotateY(22deg) rotateX(3deg) rotateZ(-1deg);
  }
  12.5% {
    transform: translate3d(28px, 4px, -20px) scale(0.96) rotateY(45deg) rotateX(2deg) rotateZ(4deg);
  }
  18.75% {
    transform: translate3d(37px, -1px, -34px) scale(0.9) rotateY(68deg) rotateX(1deg) rotateZ(5deg);
  }
  25% {
    transform: translate3d(42px, -6px, -48px) scale(0.84) rotateY(90deg) rotateX(0deg) rotateZ(6deg);
  }
  31.25% {
    transform: translate3d(37px, -11px, -62px) scale(0.77) rotateY(112deg) rotateX(-1deg) rotateZ(4deg);
  }
  37.5% {
    transform: translate3d(28px, -14px, -72px) scale(0.7) rotateY(135deg) rotateX(-2deg) rotateZ(2deg);
  }
  43.75% {
    transform: translate3d(15px, -17px, -82px) scale(0.63) rotateY(158deg) rotateX(-3deg) rotateZ(1deg);
  }
  50% {
    transform: translate3d(0, -18px, -88px) scale(0.58) rotateY(180deg) rotateX(-4deg) rotateZ(0);
  }
  56.25% {
    transform: translate3d(-15px, -17px, -82px) scale(0.63) rotateY(202deg) rotateX(-3deg) rotateZ(-1deg);
  }
  62.5% {
    transform: translate3d(-28px, -14px, -72px) scale(0.7) rotateY(225deg) rotateX(-2deg) rotateZ(-2deg);
  }
  68.75% {
    transform: translate3d(-37px, -11px, -62px) scale(0.77) rotateY(248deg) rotateX(-1deg) rotateZ(-4deg);
  }
  75% {
    transform: translate3d(-42px, -6px, -48px) scale(0.84) rotateY(270deg) rotateX(0deg) rotateZ(-6deg);
  }
  81.25% {
    transform: translate3d(-37px, -1px, -34px) scale(0.9) rotateY(292deg) rotateX(1deg) rotateZ(-5deg);
  }
  87.5% {
    transform: translate3d(-28px, 4px, -20px) scale(0.96) rotateY(315deg) rotateX(2deg) rotateZ(-4deg);
  }
  93.75% {
    transform: translate3d(-15px, 9px, -8px) scale(1.01) rotateY(338deg) rotateX(3deg) rotateZ(-3deg);
  }
  100% {
    transform: translate3d(0, 12px, 0) scale(1.04) rotateY(360deg) rotateX(4deg) rotateZ(-5deg);
  }
}

@keyframes fly-dash {
  0% {
    transform: translate3d(0, 0, 0) scale(1) rotateY(0) rotateX(8deg);
  }
  10% {
    transform: translate3d(0, 4px, 36px) scale(1.18) rotateY(-4deg) rotateX(2deg);
  }
  20% {
    transform: translate3d(0, 8px, 70px) scale(1.35) rotateY(-8deg) rotateX(-6deg);
  }
  32% {
    transform: translate3d(8px, 0, 48px) scale(1.2) rotateY(10deg) rotateX(0deg);
  }
  44% {
    transform: translate3d(-12px, -10px, -10px) scale(0.95) rotateY(80deg) rotateX(-4deg);
  }
  56% {
    transform: translate3d(-36px, -18px, -80px) scale(0.55) rotateY(160deg) rotateX(-8deg);
  }
  68% {
    transform: translate3d(-10px, -12px, -55px) scale(0.7) rotateY(220deg) rotateX(-2deg);
  }
  80% {
    transform: translate3d(24px, -8px, -30px) scale(0.85) rotateY(280deg) rotateX(4deg);
  }
  90% {
    transform: translate3d(10px, -2px, -10px) scale(0.95) rotateY(330deg) rotateX(6deg);
  }
  100% {
    transform: translate3d(0, 0, 0) scale(1) rotateY(360deg) rotateX(8deg);
  }
}

@keyframes barrel-roll {
  0% {
    transform: translate3d(0, 0, 0) rotateZ(0) rotateX(0) scale(1);
  }
  12.5% {
    transform: translate3d(10px, -6px, -4px) rotateZ(2deg) rotateX(45deg) scale(0.98);
  }
  25% {
    transform: translate3d(20px, -10px, -12px) rotateZ(4deg) rotateX(90deg) scale(0.94);
  }
  37.5% {
    transform: translate3d(30px, -6px, -20px) rotateZ(6deg) rotateX(135deg) scale(0.9);
  }
  50% {
    transform: translate3d(34px, 0, -28px) rotateZ(4deg) rotateX(180deg) scale(0.88);
  }
  62.5% {
    transform: translate3d(24px, 6px, -32px) rotateZ(-2deg) rotateX(225deg) scale(0.9);
  }
  75% {
    transform: translate3d(8px, 2px, -20px) rotateZ(-4deg) rotateX(270deg) scale(0.94);
  }
  87.5% {
    transform: translate3d(-4px, -4px, -8px) rotateZ(2deg) rotateX(315deg) scale(0.98);
  }
  100% {
    transform: translate3d(0, 0, 0) rotateZ(0) rotateX(360deg) scale(1);
  }
}

@keyframes rocket-jump {
  0% {
    transform: translateY(0) scale(1) rotateY(0) rotateZ(0);
  }
  8% {
    transform: translateY(6px) scale(1.08, 0.86) rotateY(0) rotateZ(-3deg);
  }
  16% {
    transform: translateY(8px) scale(1.12, 0.78) rotateY(10deg) rotateZ(-4deg);
  }
  28% {
    transform: translateY(-28px) scale(0.94, 1.08) rotateY(60deg) rotateZ(4deg);
  }
  40% {
    transform: translateY(-52px) scale(0.88, 1.1) rotateY(120deg) rotateZ(6deg);
  }
  52% {
    transform: translateY(-56px) scale(0.85, 1.08) rotateY(180deg) rotateZ(-4deg);
  }
  64% {
    transform: translateY(-40px) scale(0.9, 1.04) rotateY(240deg) rotateZ(2deg);
  }
  76% {
    transform: translateY(-14px) scale(0.98, 1) rotateY(300deg) rotateZ(0);
  }
  88% {
    transform: translateY(4px) scale(1.1, 0.88) rotateY(345deg) rotateZ(0);
  }
  100% {
    transform: translateY(0) scale(1) rotateY(360deg) rotateZ(0);
  }
}

@keyframes cartwheel {
  0% {
    transform: translateX(0) translateY(0) rotateZ(0) scale(1);
  }
  10% {
    transform: translateX(-6px) translateY(2px) rotateZ(-30deg) scale(1.02, 0.96);
  }
  25% {
    transform: translateX(4px) translateY(-14px) rotateZ(-90deg) scale(0.96);
  }
  40% {
    transform: translateX(20px) translateY(-18px) rotateZ(-150deg) scale(0.94);
  }
  55% {
    transform: translateX(36px) translateY(-8px) rotateZ(-220deg) scale(0.92);
  }
  70% {
    transform: translateX(28px) translateY(-4px) rotateZ(-280deg) scale(0.96);
  }
  85% {
    transform: translateX(10px) translateY(2px) rotateZ(-330deg) scale(1.02, 0.96);
  }
  100% {
    transform: translateX(0) translateY(0) rotateZ(-360deg) scale(1);
  }
}

@keyframes figure-eight {
  0% {
    transform: translate3d(0, 0, 0) rotateY(0) rotateZ(-4deg) scale(1);
  }
  12.5% {
    transform: translate3d(26px, -12px, -16px) rotateY(45deg) rotateZ(6deg) scale(0.92);
  }
  25% {
    transform: translate3d(0, -22px, -40px) rotateY(90deg) rotateZ(0) scale(0.78);
  }
  37.5% {
    transform: translate3d(-26px, -12px, -16px) rotateY(135deg) rotateZ(-6deg) scale(0.92);
  }
  50% {
    transform: translate3d(0, 0, 0) rotateY(180deg) rotateZ(4deg) scale(1);
  }
  62.5% {
    transform: translate3d(26px, 10px, -16px) rotateY(225deg) rotateZ(-4deg) scale(0.92);
  }
  75% {
    transform: translate3d(0, 18px, -40px) rotateY(270deg) rotateZ(0) scale(0.78);
  }
  87.5% {
    transform: translate3d(-26px, 10px, -16px) rotateY(315deg) rotateZ(6deg) scale(0.92);
  }
  100% {
    transform: translate3d(0, 0, 0) rotateY(360deg) rotateZ(-4deg) scale(1);
  }
}

@keyframes victory-burst {
  0% {
    transform: translateY(0) rotateY(0) scale(1);
  }
  12% {
    transform: translateY(-18px) rotateY(30deg) scale(0.94, 1.08);
  }
  24% {
    transform: translateY(0) rotateY(70deg) scale(1.08, 0.9);
  }
  36% {
    transform: translateY(-24px) rotateY(120deg) scale(0.92, 1.1);
  }
  48% {
    transform: translateY(0) rotateY(180deg) scale(1.06, 0.92);
  }
  60% {
    transform: translateY(-26px) rotateY(230deg) scale(0.9, 1.1);
  }
  72% {
    transform: translateY(0) rotateY(280deg) scale(1.06, 0.92);
  }
  86% {
    transform: translateY(-12px) rotateY(330deg) scale(0.96, 1.04);
  }
  100% {
    transform: translateY(0) rotateY(360deg) scale(1);
  }
}

@keyframes peekaboo {
  0% {
    transform: rotateY(0) scale(1) translateY(0);
  }
  15% {
    transform: rotateY(60deg) scale(0.92) translateY(2px);
  }
  30% {
    transform: rotateY(120deg) scale(0.8) translateY(6px);
  }
  42% {
    transform: rotateY(180deg) scale(0.7) translateY(8px);
  }
  55% {
    transform: rotateY(180deg) scale(0.68) translateY(10px);
  }
  68% {
    transform: rotateY(240deg) scale(0.82) translateY(-4px);
  }
  80% {
    transform: rotateY(300deg) scale(0.98) translateY(-10px);
  }
  90% {
    transform: rotateY(340deg) scale(1.06, 0.94) translateY(2px);
  }
  100% {
    transform: rotateY(360deg) scale(1) translateY(0);
  }
}

@keyframes breathe {
  0%,
  100% {
    transform: scale(1) translateY(0);
  }
  50% {
    transform: scale(0.97) translateY(2px);
  }
}
</style>
