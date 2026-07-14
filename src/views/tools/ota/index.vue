<template>
  <div class="ota-page">
    <section class="panel">
      <header class="panel-head">
        <span class="panel-title">{{ $t("ota.options") }}</span>
      </header>
      <p class="panel-hint">{{ $t("ota.hint") }}</p>
      <div class="options-row">
        <label class="option-field">
          <span class="option-label">{{ $t("ota.tableOffset") }}</span>
          <a-input
            v-model:value="tableOffset"
            placeholder="0x8000"
            class="mono"
            :disabled="loading"
          />
        </label>
        <label class="option-field">
          <span class="option-label">{{ $t("ota.baudRate") }}</span>
          <a-select v-model:value="baudRate" :options="baudOptions" />
        </label>
        <a-button type="primary" :loading="loading" @click="onLoad">
          {{ $t("ota.loadFromDevice") }}
        </a-button>
      </div>
      <p v-if="otadataPart" class="detected-info mono">
        {{
          $t("ota.otadataInfo", {
            name: otadataPart.name,
            offset: formatHexDisplay(otadataPart.offset),
            size: formatHexDisplay(otadataPart.size),
          })
        }}
      </p>
    </section>

    <section class="panel">
      <header class="panel-head">
        <span class="panel-title">{{ $t("ota.otadataTitle") }}</span>
      </header>
      <div v-if="otadataInfo" class="otadata-grid mono">
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
            <span :class="{ invalid: !copy.valid }">
              0x{{ hex8(copy.seq) }}
            </span>
          </div>
          <div>
            CRC:
            <span :class="{ invalid: !copy.valid }">
              0x{{ hex8(copy.crc) }}
            </span>
          </div>
          <div class="valid-tag" :class="{ 'is-invalid': !copy.valid }">
            {{ copy.valid ? $t("ota.valid") : $t("ota.invalid") }}
          </div>
        </div>
        <div class="otadata-active">
          <template v-if="otadataInfo.activeSlot != null">
            {{ $t("ota.activeSlot", { slot: otadataInfo.activeSlot }) }}
          </template>
          <template v-else>{{ $t("ota.activeUnknown") }}</template>
        </div>
      </div>
      <PlaceholderHint v-else :text="$t('ota.emptyOtadata')" />
      <div class="action-row">
        <a-button
          type="primary"
          danger
          :disabled="!otadataPart || loading"
          :loading="loading"
          @click="onEraseOtadata"
        >
          {{ $t("ota.eraseOtadata") }}
        </a-button>
      </div>
    </section>

    <section class="panel">
      <header class="panel-head">
        <span class="panel-title">{{ $t("ota.appTitle") }}</span>
        <span v-if="otaApps.length" class="panel-meta">
          {{ $t("ota.appCount", { n: otaApps.length }) }}
        </span>
      </header>

      <div v-if="otaApps.length" class="app-select-row">
        <span class="option-label">{{ $t("ota.selectPartition") }}</span>
        <a-select
          v-model:value="selectedKey"
          class="app-select"
          :options="appOptions"
          :disabled="loading"
        />
      </div>
      <PlaceholderHint v-else :text="$t('ota.emptyApps')" />

      <div class="action-row">
        <a-button
          type="primary"
          :disabled="!selectedPartition || loading"
          :loading="loading"
          @click="onSwitch"
        >
          {{ $t("ota.switchPartition") }}
        </a-button>
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
        <a-button
          type="primary"
          danger
          :disabled="!selectedPartition || loading"
          :loading="loading"
          @click="onEraseApp"
        >
          {{ $t("ota.erasePartition") }}
        </a-button>
      </div>
    </section>
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
  padding: 12px 16px;
}
.panel {
  margin-bottom: 16px;
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  gap: 10px;
}
.panel-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.88);
}
.panel-meta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}
.panel-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.5;
}
.options-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 16px;
}
.option-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;
}
.option-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}
.mono {
  font-family: Consolas, "Courier New", monospace;
}
.mono :deep(input) {
  font-family: Consolas, "Courier New", monospace;
}
.detected-info {
  margin: 10px 0 0;
  font-size: 12px;
  color: #52c41a;
}
.otadata-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.75);
}
.otadata-col {
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.22);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.otadata-label {
  font-weight: 500;
  margin-bottom: 4px;
  color: rgba(255, 255, 255, 0.88);
}
.otadata-active {
  grid-column: 1 / -1;
  font-size: 13px;
  color: #1677ff;
}
.valid-tag {
  margin-top: 4px;
  color: #73d13d;
  font-weight: 500;
}
.valid-tag.is-invalid {
  color: #ff8585;
}
.invalid {
  color: #ff8585;
  font-weight: 600;
}
.app-select-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.app-select {
  min-width: 360px;
  flex: 1;
}
.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
</style>
