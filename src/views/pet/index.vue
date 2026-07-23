<template>
  <div class="pet-page">
    <aside class="pet-hero" :data-model="activeLook.model" :style="heroPanelStyle">
      <div class="hero-stage">
        <PetPreviewOrbit
          :key="activeLook.id"
          :model="activeLook.model"
          :visual="v"
          :mood="tone === 'snarky' ? 'grumpy' : 'idle'"
          :fig-art-id="activeLook.figArtId"
          :toon-decor="activeLook.toonDecor"
          :hint="
            activeLook.model === 'chip'
              ? $t('pet.previewDragHint')
              : activeLook.model === 'toon'
                ? $t('pet.previewToonHint')
                : activeLook.model === 'vrm'
                  ? $t('pet.previewVrmHint')
                  : $t('pet.previewFigHint')
          "
        />
      </div>
      <div class="hero-text">
        <p class="hero-kicker">{{ $t("pet.pageTitle") }}</p>
        <h1 class="hero-name">{{ displayName || $t("pet.pageTitle") }}</h1>
        <p class="hero-tagline">{{ $t("pet.pageTagline") }}</p>
        <div class="hero-meta">
          <span class="meta-pill">{{
            $t(
              activeLook.model === "fig-sci"
                ? "pet.modelFig"
                : activeLook.model === "toon"
                  ? "pet.modelToon"
                  : activeLook.model === "vrm"
                    ? "pet.modelVrm"
                    : "pet.modelChip"
            )
          }}</span>
          <span class="meta-pill meta-pill--theme">
            <i class="theme-dot" :style="{ background: v.accent }" />
            {{ $t(activeLook.nameKey) }}
          </span>
          <span class="meta-pill">{{ personalityLabel }}</span>
          <span v-if="enabled" class="meta-pill meta-pill--on">{{ $t("pet.statusOn") }}</span>
          <span v-else class="meta-pill">{{ $t("pet.statusOff") }}</span>
        </div>
      </div>
    </aside>

    <section class="pet-list">
      <header class="panel-head">
        <span class="panel-title">{{ $t("pet.sectionControl") }}</span>
      </header>
      <div class="item-stack" :data-expanded="enabled ? '1' : '0'">
        <SettingsItemRow
          class="span-2"
          :title="$t('pet.enableTitle')"
          :description="$t('pet.enableDesc')"
          tone="pet"
        >
          <template #icon>
            <RobotOutlined />
          </template>
          <a-switch v-model:checked="enabled" size="small" @change="onEnabled" />
        </SettingsItemRow>

        <div v-if="enabled" class="pet-sub">
          <SettingsItemRow
            class="span-2"
            :title="$t('pet.formTitle')"
            :description="$t('pet.formDesc')"
            tone="pet"
          >
            <template #icon>
              <AppstoreOutlined />
            </template>
            <a-segmented
              v-model:value="modelKind"
              size="small"
              :options="formOptions"
              @change="onModel"
            />
          </SettingsItemRow>

          <SettingsItemRow
            v-if="themes.length > 0"
            class="span-2"
            :title="$t('pet.themeTitle')"
            :description="$t('pet.themeDesc')"
            tone="pet"
          >
            <template #icon>
              <SkinOutlined />
            </template>
            <div class="theme-swatches" role="listbox" :aria-label="$t('pet.themeTitle')">
              <button
                v-for="theme in themes"
                :key="theme.id"
                type="button"
                class="theme-swatch"
                :class="{
                  active: themeId === theme.id,
                  'theme-swatch--fig': !!theme.figArtId,
                }"
                :title="themeLabel(theme)"
                :style="{
                  '--swatch': theme.visual.accent,
                  '--swatch-soft': theme.visual.accentSoft,
                }"
                @click="onTheme(theme.id)"
              >
                <span class="swatch-core" />
                <span class="swatch-name">{{ themeLabel(theme) }}</span>
              </button>
            </div>
          </SettingsItemRow>

          <SettingsItemRow
            :title="$t('pet.nicknameTitle')"
            :description="$t('pet.nicknameDesc')"
            tone="pet"
          >
            <template #icon>
              <EditOutlined />
            </template>
            <div class="nickname-row">
              <a-input
                v-model:value="nickname"
                size="small"
                class="ctrl-input"
                :placeholder="skinDefaultNickname"
                :maxlength="12"
                allow-clear
              />
              <a-button size="small" type="primary" @click="onSaveNickname">
                {{ $t("pet.nicknameSave") }}
              </a-button>
            </div>
          </SettingsItemRow>

          <SettingsItemRow
            :title="$t('pet.personalityTitle')"
            :description="$t('pet.personalityDesc')"
            tone="pet"
          >
            <template #icon>
              <UserOutlined />
            </template>
            <a-segmented
              v-model:value="personality"
              size="small"
              :options="personalityOptions"
              @change="onPersonality"
            />
          </SettingsItemRow>

          <SettingsItemRow
            :title="$t('pet.muteTitle')"
            :description="$t('pet.muteDesc')"
            tone="pet"
          >
            <template #icon>
              <SoundOutlined v-if="!muted" />
              <AudioMutedOutlined v-else />
            </template>
            <a-switch v-model:checked="muted" size="small" @change="onMuted" />
          </SettingsItemRow>

          <SettingsItemRow
            :title="$t('pet.opacityTitle')"
            :description="$t('pet.opacityDesc')"
            tone="pet"
          >
            <template #icon>
              <EyeOutlined />
            </template>
            <div
              class="opacity-row"
              title="双击复位"
              @dblclick="resetOpacity"
            >
              <a-slider
                v-model:value="opacityPercent"
                :min="30"
                :max="100"
                :step="5"
                style="width: 120px; margin: 0"
                @change="onOpacity"
              />
              <span class="opacity-label">{{ opacityPercent }}%</span>
            </div>
          </SettingsItemRow>

          <SettingsItemRow
            :title="$t('pet.zoomTitle')"
            :description="$t('pet.zoomDesc')"
            tone="pet"
          >
            <template #icon>
              <ZoomInOutlined />
            </template>
            <div class="opacity-row" title="双击复位" @dblclick="resetZoom">
              <a-slider
                v-model:value="zoomPercent"
                :min="-100"
                :max="100"
                :step="5"
                style="width: 120px; margin: 0"
                @change="onZoom"
              />
              <span class="opacity-label"
                >{{ zoomPercent > 0 ? "+" : "" }}{{ zoomPercent }}%</span
              >
            </div>
          </SettingsItemRow>

          <SettingsItemRow
            :title="$t('pet.toneTitle')"
            :description="$t('pet.toneDesc')"
            tone="pet"
          >
            <template #icon>
              <SmileOutlined />
            </template>
            <a-segmented
              v-model:value="tone"
              size="small"
              :options="toneOptions"
              @change="onTone"
            />
          </SettingsItemRow>

          <SettingsItemRow
            :title="$t('pet.usbWatchTitle')"
            :description="$t('pet.usbWatchDesc')"
            tone="pet"
          >
            <template #icon>
              <UsbOutlined />
            </template>
            <a-switch
              v-model:checked="usbWatchEnabled"
              size="small"
              @change="onUsbWatch"
            />
          </SettingsItemRow>

          <SettingsItemRow
            class="span-2"
            :title="$t('pet.motionTitle')"
            :description="$t('pet.motionDesc')"
            tone="pet"
          >
            <template #icon>
              <ThunderboltOutlined />
            </template>
            <div class="motion-row">
              <a-select
                v-model:value="demoMotion"
                size="small"
                class="ctrl-select"
                :options="motionOptions"
                :list-height="360"
                @change="onDemoMotion"
              />
              <a-button size="small" type="primary" @click="onPlayMotion">
                {{ $t("pet.motionPlay") }}
              </a-button>
            </div>
          </SettingsItemRow>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  AppstoreOutlined,
  AudioMutedOutlined,
  EditOutlined,
  EyeOutlined,
  RobotOutlined,
  SkinOutlined,
  SmileOutlined,
  SoundOutlined,
  ThunderboltOutlined,
  UsbOutlined,
  UserOutlined,
  ZoomInOutlined,
} from "@ant-design/icons-vue";
import { message } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import SettingsItemRow from "@/views/settings/shared/components/SettingsItemRow.vue";
import PetPreviewOrbit from "@/pet/models/PetPreviewOrbit.vue";
import {
  demoMotionsForModel,
  isPetIdleMotion,
  type PetIdleMotion,
} from "@/pet/motions";
import { requestPetIntro, requestPetMotion } from "@/pet";
import { loadPetSettings, publishPetSettings } from "@/pet/settings";
import { syncPetWindow } from "@/pet/petWindow";
import {
  coerceThemeIdForModel,
  isPetModelKind,
  listPetThemesForModel,
  resolveAppearance,
  resolveNickname,
  type PetModelKind,
} from "@/pet/skins";
import {
  isPetPersonality,
  type PetPersonality,
} from "@/pet/personality";
import type { PetTone } from "@/pet/types";

const { t } = useI18n();

const enabled = ref(false);
const muted = ref(false);
const opacityPercent = ref(100);
const zoomPercent = ref(0);
const tone = ref<PetTone>("cute");
const demoMotion = ref<PetIdleMotion>("fly-orbit");
const modelKind = ref<PetModelKind>("chip");
const themeId = ref("cyan");
const nickname = ref("");
const personality = ref<PetPersonality>("sunny");
const usbWatchEnabled = ref(true);

const themes = computed(() => listPetThemesForModel(modelKind.value));

function themeLabel(theme: { nameKey: string; toonNameKey?: string }) {
  if (modelKind.value === "toon" && theme.toonNameKey) {
    return t(theme.toonNameKey);
  }
  return t(theme.nameKey);
}
const toneOptions = computed(() => [
  { label: t("pet.toneCute"), value: "cute" },
  { label: t("pet.toneSnarky"), value: "snarky" },
]);

const personalityOptions = computed(() => [
  { label: t("pet.personalitySunny"), value: "sunny" },
  { label: t("pet.personalityShy"), value: "shy" },
  { label: t("pet.personalityCool"), value: "cool" },
  { label: t("pet.personalityFiery"), value: "fiery" },
]);

const formOptions = computed(() => [
  { label: t("pet.modelChip"), value: "chip" },
  { label: t("pet.modelFig"), value: "fig-sci" },
  { label: t("pet.modelToon"), value: "toon" },
  { label: t("pet.modelVrm"), value: "vrm" },
]);

const motionOptions = computed(() =>
  demoMotionsForModel(modelKind.value).map((value) => ({
    value,
    label: t(`pet.motion.${value}`),
  }))
);

const activeLook = computed(() =>
  resolveAppearance(modelKind.value, themeId.value)
);
const skinDefaultNickname = computed(() => activeLook.value.defaultNickname);
const displayName = computed(() =>
  resolveNickname(nickname.value, activeLook.value)
);
const v = computed(() => activeLook.value.visual);

const heroPanelStyle = computed(() => {
  const vis = v.value;
  return {
    "--hero-accent": vis.accent,
    "--hero-accent-soft": vis.accentSoft,
    background: `
      radial-gradient(ellipse at 30% 18%, color-mix(in srgb, ${vis.accent} 22%, transparent), transparent 52%),
      radial-gradient(ellipse at 82% 90%, color-mix(in srgb, ${vis.accentSoft} 14%, transparent), transparent 48%),
      linear-gradient(165deg, rgba(16, 18, 28, 0.94), rgba(6, 8, 14, 0.98))
    `,
  } as Record<string, string>;
});

const personalityLabel = computed(() => {
  if (personality.value === "shy") return t("pet.personalityShy");
  if (personality.value === "cool") return t("pet.personalityCool");
  if (personality.value === "fiery") return t("pet.personalityFiery");
  return t("pet.personalitySunny");
});

function currentSettings() {
  return {
    enabled: enabled.value,
    muted: muted.value,
    opacity: opacityPercent.value / 100,
    tone: tone.value,
    demoMotion: demoMotion.value,
    modelKind: modelKind.value,
    themeId: themeId.value,
    nickname: nickname.value.trim(),
    personality: personality.value,
    zoomPercent: zoomPercent.value,
    usbWatchEnabled: usbWatchEnabled.value,
  };
}

async function persistAndSync() {
  await publishPetSettings(currentSettings());
  await syncPetWindow();
}

async function persistOnly() {
  await publishPetSettings(currentSettings());
}

onMounted(() => {
  const s = loadPetSettings();
  enabled.value = s.enabled;
  muted.value = s.muted;
  opacityPercent.value = Math.round(s.opacity * 100);
  zoomPercent.value = s.zoomPercent;
  tone.value = s.tone;
  demoMotion.value = isPetIdleMotion(s.demoMotion) ? s.demoMotion : "fly-orbit";
  modelKind.value = s.modelKind;
  themeId.value = coerceThemeIdForModel(s.themeId, s.modelKind);
  nickname.value = s.nickname;
  personality.value = s.personality;
  usbWatchEnabled.value = s.usbWatchEnabled;
});

async function onEnabled(value: boolean) {
  enabled.value = value;
  await persistAndSync();
}

async function onModel(value: string | number) {
  if (!isPetModelKind(value)) return;
  const prev = resolveAppearance(
    loadPetSettings().modelKind,
    loadPetSettings().themeId
  );
  const trimmed = nickname.value.trim();
  if (!trimmed || trimmed === prev.defaultNickname) {
    nickname.value = "";
  }
  modelKind.value = value;
  themeId.value = coerceThemeIdForModel(themeId.value, value);
  const allowed = demoMotionsForModel(value);
  if (!allowed.includes(demoMotion.value)) {
    demoMotion.value = allowed[0] ?? "happy-bounce";
  }
  await persistAndSync();
}

async function onTheme(id: string) {
  const prev = resolveAppearance(modelKind.value, themeId.value);
  const trimmed = nickname.value.trim();
  if (!trimmed || trimmed === prev.defaultNickname) {
    nickname.value = "";
  }
  themeId.value = id;
  await persistAndSync();
}

async function onSaveNickname() {
  await persistAndSync();
  if (!enabled.value) {
    message.warning(t("pet.motionNeedEnable"));
    return;
  }
  try {
    await requestPetIntro();
    message.success(t("pet.nicknameSaved"));
  } catch {
    message.error(t("pet.nicknameSaveFailed"));
  }
}

async function onPersonality(value: string | number) {
  if (!isPetPersonality(value)) return;
  personality.value = value;
  await persistOnly();
}

async function onMuted(value: boolean) {
  muted.value = value;
  await persistOnly();
}

async function onOpacity(value: number) {
  opacityPercent.value = value;
  await persistOnly();
}

async function onZoom(value: number) {
  zoomPercent.value = value;
  await persistOnly();
}

async function resetOpacity() {
  opacityPercent.value = 100;
  await onOpacity(100);
}

async function resetZoom() {
  zoomPercent.value = 0;
  await onZoom(0);
}

async function onTone(value: string | number) {
  tone.value = value === "snarky" ? "snarky" : "cute";
  await persistOnly();
}

async function onUsbWatch(value: boolean) {
  usbWatchEnabled.value = value;
  await persistOnly();
}

async function onDemoMotion(value: unknown) {
  if (!isPetIdleMotion(value)) return;
  demoMotion.value = value;
  await persistOnly();
}

async function onPlayMotion() {
  if (!enabled.value) {
    message.warning(t("pet.motionNeedEnable"));
    return;
  }
  try {
    await requestPetMotion(demoMotion.value);
  } catch {
    message.error(t("pet.motionPlayFailed"));
  }
}
</script>

<style scoped>
.pet-page {
  display: grid;
  grid-template-columns: minmax(280px, 380px) minmax(340px, 520px);
  grid-template-rows: minmax(0, 1fr);
  justify-content: center;
  align-content: stretch;
  column-gap: 18px;
  row-gap: 14px;
  height: 100%;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
  padding: 14px 20px 16px;
  box-sizing: border-box;
}

.pet-hero {
  min-width: 0;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--hero-accent, #00e5ff) 28%, rgba(255, 255, 255, 0.06));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 12px 40px rgba(0, 0, 0, 0.28);
  overflow: hidden;
}

.hero-stage {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.12);
}

.pet-hero[data-model="chip"] .hero-stage {
  /* 放大时裁切在圆角内，避免溢出到下方文案 */
  overflow: hidden;
}

.pet-list {
  min-width: 0;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 48px),
    rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}

.hero-text {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
}

.hero-kicker {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--hero-accent, #00e5ff) 75%, rgba(255, 255, 255, 0.4));
}

.hero-name {
  margin: 0;
  font-size: clamp(20px, 2.4vw, 28px);
  font-weight: 650;
  color: rgba(255, 255, 255, 0.96);
  letter-spacing: 0.02em;
  line-height: 1.15;
}

.hero-tagline {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
}

.meta-pill--on {
  color: color-mix(in srgb, var(--hero-accent, #00e5ff) 85%, #fff);
  border-color: color-mix(in srgb, var(--hero-accent, #00e5ff) 35%, transparent);
  background: color-mix(in srgb, var(--hero-accent, #00e5ff) 12%, transparent);
}

.theme-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 8px currentColor;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.72);
}

.item-stack {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  padding: 12px 14px 14px;
  overflow: auto;
  min-height: 0;
  flex: 1 1 0;
  align-content: start;
  width: 100%;
  max-width: none;
  margin-inline: 0;
  box-sizing: border-box;
}

/* 双列仅在够宽时启用，避免窄列把标题挤成竖排字 */
.item-stack[data-expanded="1"] {
  grid-template-columns: 1fr;
}

.item-stack :deep(.span-2),
.pet-sub :deep(.span-2) {
  grid-column: 1 / -1;
}

.item-stack :deep(.settings-item) {
  border-radius: 12px;
  border-color: rgba(255, 255, 255, 0.07);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(0, 0, 0, 0.18));
  flex-wrap: nowrap;
  align-items: center;
  gap: 10px 12px;
  padding: 12px 14px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.item-stack :deep(.item-main) {
  flex: 1 1 auto;
  min-width: 0;
}

.item-stack :deep(.item-text) {
  min-width: 0;
  overflow: hidden;
}

.item-stack :deep(.item-title),
.item-stack :deep(.item-desc) {
  overflow-wrap: anywhere;
  word-break: break-word;
}

.item-stack :deep(.item-actions) {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 240px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.pet-sub {
  display: contents;
}

.theme-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  max-width: 100%;
}

.theme-swatch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 7px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.theme-swatch:hover {
  border-color: color-mix(in srgb, var(--swatch) 45%, rgba(255, 255, 255, 0.2));
  background: color-mix(in srgb, var(--swatch) 10%, transparent);
}

.theme-swatch.active {
  border-color: color-mix(in srgb, var(--swatch) 65%, transparent);
  background: color-mix(in srgb, var(--swatch) 16%, transparent);
  color: #fff;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--swatch) 25%, transparent);
}

.theme-swatch--fig {
  border-style: dashed;
}

.swatch-core {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 30%, #fff 0 18%, transparent 19%),
    linear-gradient(135deg, var(--swatch-soft), var(--swatch));
  box-shadow: 0 0 10px color-mix(in srgb, var(--swatch) 55%, transparent);
}

.swatch-name {
  font-size: 12px;
  line-height: 1;
}

.opacity-row,
.motion-row,
.nickname-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  width: 100%;
  max-width: 240px;
  min-width: 0;
}

.nickname-row,
.motion-row {
  flex-wrap: nowrap;
  max-width: 220px;
}

.nickname-row .ctrl-input,
.motion-row .ctrl-select {
  flex: 1 1 auto;
  width: auto;
  min-width: 0;
  max-width: none;
}

.nickname-row :deep(.ant-btn),
.motion-row :deep(.ant-btn) {
  flex-shrink: 0;
}

.opacity-label {
  min-width: 40px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  text-align: right;
}

.ctrl-input {
  width: 140px;
  max-width: 100%;
  flex: 0 1 140px;
}

.ctrl-select {
  width: 148px;
  max-width: 100%;
  flex: 0 1 148px;
}

.opacity-row :deep(.ant-slider) {
  flex: 1 1 100px;
  min-width: 80px;
  max-width: 160px;
}

/* 窄屏：上下分栏，两块内容水平居中 */
@media (max-width: 1180px) {
  .pet-page {
    grid-template-columns: minmax(0, 520px);
    grid-template-rows: minmax(160px, 36%) minmax(0, 1fr);
    justify-content: center;
    overflow: hidden;
  }

  .pet-hero,
  .pet-list {
    height: 100%;
    max-height: 100%;
    min-height: 0;
    width: 100%;
  }

  .hero-stage {
    min-height: 0;
    max-height: none;
  }

  .hero-tagline {
    -webkit-line-clamp: 1;
  }

  .item-stack :deep(.item-actions) {
    justify-content: flex-start;
  }

  .theme-swatches {
    justify-content: flex-start;
  }
}

@media (max-width: 980px) {
  .pet-page {
    grid-template-columns: minmax(0, 440px);
    grid-template-rows: minmax(140px, 32%) minmax(0, 1fr);
  }

  .item-stack :deep(.settings-item) {
    flex-direction: column;
    align-items: stretch;
  }

  .item-stack :deep(.item-actions) {
    width: 100%;
    max-width: 100%;
    justify-content: flex-start;
  }

  .nickname-row,
  .motion-row,
  .opacity-row {
    max-width: 100%;
  }
}

@media (max-width: 640px) {
  .pet-page {
    padding: 8px;
    gap: 10px;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(120px, 28%) minmax(0, 1fr);
  }

  .pet-hero {
    padding: 10px;
    gap: 8px;
  }

  .hero-meta {
    display: none;
  }

  .item-stack :deep(.item-desc) {
    display: none;
  }
}
</style>
