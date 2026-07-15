<template>
  <div class="ota-page">
    <section class="toolbar panel">
      <div class="toolbar-main">
        <div class="toolbar-fields">
          <label class="field">
            <span class="field-label">{{ $t("ota.tableOffset") }}</span>
            <a-input
              v-model:value="tableOffset"
              placeholder="0x8000"
              class="offset-input mono"
              :disabled="loading"
              allow-clear
            />
          </label>
          <label class="field">
            <span class="field-label">{{ $t("ota.baudRate") }}</span>
            <a-select
              v-model:value="baudRate"
              class="baud-select"
              :options="baudOptions"
              :disabled="loading"
            />
          </label>
        </div>
        <p class="toolbar-hint">{{ $t("ota.hint") }}</p>
      </div>
      <div class="toolbar-actions">
        <span v-if="otadataPart" class="detected-info mono">
          {{
            $t("ota.otadataInfo", {
              name: otadataPart.name,
              offset: formatHexDisplay(otadataPart.offset),
              size: formatHexDisplay(otadataPart.size),
            })
          }}
        </span>
        <a-button type="primary" :loading="loading" @click="onLoad">
          {{ $t("ota.loadFromDevice") }}
        </a-button>
      </div>
    </section>

    <div class="ota-content">
      <section class="panel panel-otadata">
        <header class="panel-head">
          <span class="panel-title">{{ $t("ota.otadataTitle") }}</span>
          <a-button
            danger
            size="small"
            :disabled="!otadataPart || loading"
            :loading="loading"
            @click="onEraseOtadata"
          >
            {{ $t("ota.eraseOtadata") }}
          </a-button>
        </header>

        <div v-if="otadataInfo?.copies?.length" class="otadata-body">
          <div class="otadata-grid mono">
            <div
              v-for="(copy, idx) in otadataInfo.copies"
              :key="idx"
              class="otadata-col"
            >
              <div class="otadata-label">
                {{ idx === 0 ? $t("ota.copy0") : $t("ota.copy1") }}
              </div>
              <div>
                SEQ:
                <span :class="{ 'is-dim': !copy.valid }">
                  0x{{ hex8(copy.seq) }}
                </span>
              </div>
              <div>
                CRC:
                <span :class="{ 'is-dim': !copy.valid }">
                  0x{{ hex8(copy.crc) }}
                </span>
              </div>
              <a-tag
                class="status-tag"
                :color="copy.valid ? 'success' : 'default'"
              >
                {{ copy.valid ? $t("ota.valid") : $t("ota.invalid") }}
              </a-tag>
            </div>
          </div>
          <div class="otadata-active">
            <a-tag v-if="otadataInfo.activeSlot != null" color="processing">
              {{ $t("ota.activeSlot", { slot: otadataInfo.activeSlot }) }}
            </a-tag>
            <a-tag v-else color="default">
              {{ $t("ota.activeUnknown") }}
            </a-tag>
          </div>
        </div>
        <div v-else class="panel-empty">
          <PlaceholderHint :text="$t('ota.emptyOtadata')" />
        </div>
      </section>

      <section class="panel panel-apps">
        <header class="panel-head">
          <div class="panel-head-main">
            <span class="panel-title">{{ $t("ota.appTitle") }}</span>
            <span v-if="otaApps.length" class="panel-meta">
              {{ $t("ota.appCount", { n: otaApps.length }) }}
            </span>
          </div>
        </header>

        <div v-if="otaApps.length" class="apps-body">
          <label class="field field-block">
            <span class="field-label">{{ $t("ota.selectPartition") }}</span>
            <a-select
              v-model:value="selectedKey"
              class="app-select"
              :options="appOptions"
              :disabled="loading"
            />
          </label>

          <div class="action-groups">
            <div class="action-group">
              <div class="action-group-label">{{ $t("ota.groupBoot") }}</div>
              <a-button
                type="primary"
                :disabled="!selectedPartition || loading"
                :loading="loading"
                @click="onSwitch"
              >
                {{ $t("ota.switchPartition") }}
              </a-button>
            </div>
            <div class="action-group">
              <div class="action-group-label">{{ $t("ota.groupData") }}</div>
              <div class="action-row">
                <a-button
                  :disabled="!selectedPartition || loading"
                  :loading="loading"
                  @click="onRead"
                >
                  {{ $t("ota.readPartition") }}
                </a-button>
                <a-button
                  :disabled="!selectedPartition || loading"
                  :loading="loading"
                  @click="onWrite"
                >
                  {{ $t("ota.writePartition") }}
                </a-button>
              </div>
            </div>
            <div class="action-group">
              <div class="action-group-label">{{ $t("ota.groupDanger") }}</div>
              <a-button
                danger
                :disabled="!selectedPartition || loading"
                :loading="loading"
                @click="onEraseApp"
              >
                {{ $t("ota.erasePartition") }}
              </a-button>
            </div>
          </div>
        </div>
        <div v-else class="panel-empty">
          <PlaceholderHint :text="$t('ota.emptyApps')" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h } from "vue";
import { Modal, message } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import PlaceholderHint from "@/components/PlaceholderHint.vue";
import {
  READ_BAUD_RATE_OPTIONS,
  toBaudSelectOptions,
} from "@/composables/useFlashOptions";
import { formatHexDisplay } from "@/utils/partitionBin";
import { useOtaTool } from "./composables/useOtaTool";

const { t } = useI18n();
const baudOptions = toBaudSelectOptions(READ_BAUD_RATE_OPTIONS);

const {
  loading,
  baudRate,
  tableOffset,
  otadataPart,
  otaApps,
  otadataInfo,
  selectedKey,
  selectedPartition,
  partitionKey,
  formatPartitionLabel,
  loadFromDevice,
  eraseOtadata,
  switchToSelected,
  readOtaPartition,
  writeOtaPartition,
  pickFirmwareFile,
  eraseOtaPartition,
} = useOtaTool();

const appOptions = computed(() =>
  otaApps.value.map((p) => ({
    label: formatPartitionLabel(p),
    value: partitionKey(p),
  }))
);

function hex8(n: number): string {
  return (n >>> 0).toString(16).padStart(8, "0");
}

function handleError(e: unknown, fallbackKey: string) {
  if (e instanceof Error) {
    if (e.message === "NO_PORT") {
      message.warning(t("ota.noPort"));
      return;
    }
    if (e.message === "NO_OTADATA") {
      message.warning(t("ota.noOtadata"));
      return;
    }
    if (e.message === "NO_OTA_APP") {
      message.warning(t("ota.noOtaApp"));
      return;
    }
    if (e.message === "EMPTY_PARTITION") {
      message.warning(t("ota.emptyPartition"));
      return;
    }
    if (e.message === "BAD_TABLE_OFFSET") {
      message.warning(t("ota.badTableOffset"));
      return;
    }
    if (e.message === "NO_TARGET") {
      message.warning(t("ota.noTarget"));
      return;
    }
  }
  message.error(t(fallbackKey));
}

async function onLoad() {
  try {
    await loadFromDevice();
    message.success(t("ota.loadSuccess"));
  } catch (e) {
    handleError(e, "ota.loadFailed");
  }
}

function onEraseOtadata() {
  Modal.confirm({
    title: t("ota.confirmEraseOtadataTitle"),
    content: t("ota.confirmEraseOtadataBody"),
    okText: t("ota.confirmOk"),
    okType: "danger",
    cancelText: t("ota.confirmCancel"),
    async onOk() {
      try {
        await eraseOtadata();
        message.success(t("ota.eraseOtadataSuccess"));
      } catch (e) {
        handleError(e, "ota.opFailed");
        throw e;
      }
    },
  });
}

function onSwitch() {
  const p = selectedPartition.value;
  if (!p) {
    message.warning(t("ota.noTarget"));
    return;
  }
  Modal.confirm({
    title: t("ota.confirmSwitchTitle"),
    content: () =>
      h("div", null, [
        h("p", { style: "margin:0 0 6px;" }, t("ota.confirmSwitchBody")),
        h("p", { class: "mono", style: "margin:0;" }, formatPartitionLabel(p)),
      ]),
    okText: t("ota.confirmOk"),
    cancelText: t("ota.confirmCancel"),
    async onOk() {
      try {
        await switchToSelected();
        message.success(t("ota.switchSuccess"));
      } catch (e) {
        handleError(e, "ota.opFailed");
        throw e;
      }
    },
  });
}

async function onRead() {
  try {
    const path = await readOtaPartition();
    message.success(t("ota.readSuccess", { path }));
  } catch (e) {
    handleError(e, "ota.opFailed");
  }
}

async function onWrite() {
  const p = selectedPartition.value;
  if (!p) {
    message.warning(t("ota.noTarget"));
    return;
  }
  let inputPath: string | null = null;
  try {
    inputPath = await pickFirmwareFile();
  } catch {
    message.error(t("ota.opFailed"));
    return;
  }
  if (!inputPath) {
    return;
  }
  const firmwarePath = inputPath;
  Modal.confirm({
    title: t("ota.confirmWriteTitle"),
    content: () =>
      h("div", null, [
        h("p", { style: "margin:0 0 6px;" }, t("ota.confirmWriteBody")),
        h("p", { class: "mono", style: "margin:0 0 6px;" }, formatPartitionLabel(p)),
        h("p", { class: "mono", style: "margin:0; opacity:0.65;" }, firmwarePath),
      ]),
    okText: t("ota.confirmOk"),
    cancelText: t("ota.confirmCancel"),
    async onOk() {
      try {
        await writeOtaPartition(firmwarePath);
        message.success(t("ota.writeSuccess", { path: firmwarePath }));
      } catch (e) {
        handleError(e, "ota.opFailed");
        throw e;
      }
    },
  });
}

function onEraseApp() {
  const p = selectedPartition.value;
  if (!p) {
    message.warning(t("ota.noTarget"));
    return;
  }
  Modal.confirm({
    title: t("ota.confirmEraseAppTitle"),
    content: () =>
      h("div", null, [
        h("p", { style: "margin:0 0 6px;" }, t("ota.confirmEraseAppBody")),
        h("p", { class: "mono", style: "margin:0;" }, formatPartitionLabel(p)),
      ]),
    okText: t("ota.confirmOk"),
    okType: "danger",
    cancelText: t("ota.confirmCancel"),
    async onOk() {
      try {
        await eraseOtaPartition();
        message.success(t("ota.eraseAppSuccess"));
      } catch (e) {
        handleError(e, "ota.opFailed");
        throw e;
      }
    },
  });
}
</script>

<style scoped>
.ota-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  padding: 12px 16px;
}

.panel {
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

.toolbar {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px 16px;
}

.toolbar-main {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 20px;
  min-width: 0;
  flex: 1;
}

.toolbar-fields {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 20px;
}

.toolbar-hint {
  margin: 0;
  flex: 1;
  min-width: 220px;
  font-size: 12px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.45);
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-block {
  width: 100%;
}

.field-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.offset-input,
.baud-select {
  width: 140px;
}

.mono {
  font-family: Consolas, "Courier New", monospace;
}

.mono :deep(input) {
  font-family: Consolas, "Courier New", monospace;
}

.detected-info {
  font-size: 12px;
  color: #52c41a;
  white-space: nowrap;
}

.ota-content {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 12px;
}

@media (max-width: 1100px) {
  .ota-content {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .panel-otadata,
  .panel-apps {
    min-height: 280px;
  }
}

.panel-otadata,
.panel-apps {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-shrink: 0;
  margin-bottom: 12px;
}

.panel-head-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.panel-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.88);
  white-space: nowrap;
}

.panel-meta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.panel-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
}

.otadata-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.otadata-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  font-size: 12px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.85);
}

.otadata-col {
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.otadata-label {
  font-weight: 500;
  margin-bottom: 4px;
  color: rgba(255, 255, 255, 0.88);
}

.otadata-active {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.status-tag {
  margin-top: 6px;
}

.is-dim {
  color: rgba(255, 255, 255, 0.45);
}

.apps-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.app-select {
  width: 100%;
}

.action-groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.action-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
}

.action-group-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
