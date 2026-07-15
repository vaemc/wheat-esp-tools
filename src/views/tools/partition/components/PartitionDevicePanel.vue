<template>
  <div class="device-panel">
    <section class="toolbar panel">
      <div class="toolbar-fields">
        <label class="field">
          <span class="field-label">{{ $t("partition.tableOffset") }}</span>
          <a-input
            v-model:value="tableOffset"
            placeholder="0x8000"
            class="offset-input mono"
            :disabled="loading || opsBusy"
            allow-clear
          />
        </label>
        <label class="field">
          <span class="field-label">{{ $t("partition.baudRate") }}</span>
          <a-select
            v-model:value="baudRate"
            class="baud-select"
            :options="baudOptions"
            :disabled="loading || opsBusy"
          />
        </label>
      </div>
      <div class="toolbar-actions">
        <span v-if="partitions.length" class="device-meta">
          {{ $t("partition.deviceCount", { n: partitions.length }) }}
        </span>
        <a-button
          type="primary"
          :loading="loading"
          :disabled="opsBusy"
          @click="onReadFromDevice"
        >
          {{ $t("partition.readFromDevice") }}
        </a-button>
      </div>
    </section>

    <div class="device-content">
      <section class="panel panel-charts">
        <header class="panel-head">
          <span class="panel-title">{{ $t("partition.layout") }}</span>
        </header>
        <div class="panel-body">
          <PartitionCharts
            :partitions="partitions"
            :empty-text="$t('partition.emptyDeviceCharts')"
            compact
          />
        </div>
      </section>

      <section class="panel panel-table">
        <header class="panel-head">
          <div class="panel-head-main">
            <span class="panel-title">{{ $t("partition.preview") }}</span>
            <span v-if="result" class="panel-meta">
              {{ $t("partition.flashUsage") }} {{ result.totalSizeMb }}
            </span>
          </div>
          <a-button
            size="small"
            :disabled="!result?.csv || opsBusy"
            @click="copyCsv"
          >
            {{ $t("partition.copy") }}
          </a-button>
        </header>
        <div class="panel-body">
          <PartitionDetailTable
            :rows="result?.rows ?? []"
            :columns="columns"
            :empty-text="$t('partition.emptyDevicePreview')"
            :actions-title="$t('partition.colActions')"
            show-actions
            fill
          >
            <template #actions="{ index }">
              <span class="row-actions">
                <a-button
                  type="link"
                  size="small"
                  :disabled="actionsDisabled && !isRowBusy(index, 'read')"
                  :loading="isRowBusy(index, 'read')"
                  @click="onReadPartition(index)"
                >
                  {{ $t("partition.opRead") }}
                </a-button>
                <a-button
                  type="link"
                  size="small"
                  :disabled="actionsDisabled && !isRowBusy(index, 'write')"
                  :loading="isRowBusy(index, 'write')"
                  @click="onWritePartition(index)"
                >
                  {{ $t("partition.opWrite") }}
                </a-button>
                <a-button
                  type="link"
                  size="small"
                  danger
                  :disabled="actionsDisabled && !isRowBusy(index, 'erase')"
                  :loading="isRowBusy(index, 'erase')"
                  @click="onErasePartition(index)"
                >
                  {{ $t("partition.opErase") }}
                </a-button>
              </span>
            </template>
          </PartitionDetailTable>
        </div>
      </section>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, h, ref } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { Modal, message } from "ant-design-vue";
import PartitionCharts from "@/components/PartitionCharts.vue";
import PartitionDetailTable from "./PartitionDetailTable.vue";
import { usePartitionFromDevice } from "../composables/usePartitionFromDevice";
import { usePartitionColumns } from "../composables/usePartitionColumns";
import { usePartitionOps } from "../composables/usePartitionOps";
import {
  READ_BAUD_RATE_OPTIONS,
  toBaudSelectOptions,
} from "@/composables/useFlashOptions";
import { usePartitionTableStore } from "@/stores/partitionTable";
import type { FlashPartition } from "@/utils/partitionBin";

const { t } = useI18n();
const baudRate = ref("460800");
const { tableOffset } = storeToRefs(usePartitionTableStore());
const baudOptions = toBaudSelectOptions(READ_BAUD_RATE_OPTIONS);
const { loading, partitions, result, readFromDevice } = usePartitionFromDevice();
const { columns } = usePartitionColumns();
const {
  busy: opsBusy,
  busyKey,
  partitionKey,
  formatPartitionLabel,
  readPartition,
  erasePartition,
  writePartition,
  pickBinaryFile,
} = usePartitionOps();

const activeOp = ref<"read" | "write" | "erase" | "">("");

const actionsDisabled = computed(() => loading.value || opsBusy.value);

function partitionAt(index: number): FlashPartition | null {
  return partitions.value[index] ?? null;
}

function isRowBusy(index: number, op: "read" | "write" | "erase"): boolean {
  const p = partitionAt(index);
  if (!p || !opsBusy.value) return false;
  return busyKey.value === partitionKey(p) && activeOp.value === op;
}

function handleOpsError(e: unknown, fallbackKey: string) {
  if (e instanceof Error) {
    if (e.message === "NO_PORT") {
      message.warning(t("partition.noPort"));
      return;
    }
    if (e.message === "BUSY") {
      message.warning(t("partition.opBusy"));
      return;
    }
    if (e.message === "FILE_TOO_LARGE") {
      message.warning(t("partition.fileTooLarge"));
      return;
    }
  }
  message.error(t(fallbackKey));
}

async function onReadFromDevice() {
  try {
    await readFromDevice(baudRate.value);
    message.success(t("partition.readDeviceSuccess"));
  } catch (e) {
    if (e instanceof Error && e.message === "NO_PORT") {
      message.warning(t("partition.noPort"));
    } else if (e instanceof Error && e.message === "BAD_TABLE_OFFSET") {
      message.warning(t("partition.badTableOffset"));
    } else if (e instanceof Error && e.message === "EMPTY_PARTITION") {
      message.warning(t("partition.emptyPartition"));
    } else {
      message.error(t("partition.readDeviceFailed"));
    }
  }
}

async function copyCsv() {
  if (!result.value?.csv) {
    return;
  }
  try {
    await navigator.clipboard.writeText(result.value.csv);
    message.success(t("partition.copied"));
  } catch {
    message.error(t("partition.copyFailed"));
  }
}

async function onReadPartition(index: number) {
  const p = partitionAt(index);
  if (!p) return;
  activeOp.value = "read";
  try {
    const path = await readPartition(baudRate.value, p);
    message.success(t("partition.readPartSuccess", { path }));
  } catch (e) {
    handleOpsError(e, "partition.readPartFailed");
  } finally {
    activeOp.value = "";
  }
}

async function onWritePartition(index: number) {
  const p = partitionAt(index);
  if (!p) return;

  let inputPath: string | null = null;
  try {
    inputPath = await pickBinaryFile();
  } catch {
    message.error(t("partition.writePartFailed"));
    return;
  }
  if (!inputPath) {
    return;
  }
  const firmwarePath = inputPath;

  Modal.confirm({
    title: t("partition.confirmWriteTitle"),
    content: () =>
      h("div", null, [
        h("p", { style: "margin:0 0 6px;" }, t("partition.confirmWriteBody")),
        h(
          "p",
          { class: "mono", style: "margin:0 0 6px;" },
          formatPartitionLabel(p)
        ),
        h(
          "p",
          { class: "mono", style: "margin:0; opacity:0.65;" },
          firmwarePath
        ),
      ]),
    okText: t("partition.confirmOk"),
    cancelText: t("partition.confirmCancel"),
    async onOk() {
      activeOp.value = "write";
      try {
        await writePartition(baudRate.value, p, firmwarePath);
        message.success(t("partition.writePartSuccess"));
      } catch (e) {
        handleOpsError(e, "partition.writePartFailed");
        throw e;
      } finally {
        activeOp.value = "";
      }
    },
  });
}

function onErasePartition(index: number) {
  const p = partitionAt(index);
  if (!p) return;

  Modal.confirm({
    title: t("partition.confirmEraseTitle"),
    content: () =>
      h("div", null, [
        h("p", { style: "margin:0 0 6px;" }, t("partition.confirmEraseBody")),
        h("p", { class: "mono", style: "margin:0;" }, formatPartitionLabel(p)),
        h(
          "p",
          { style: "margin:8px 0 0; color:#fa8c16; font-size:12px;" },
          t("partition.confirmEraseWarn")
        ),
      ]),
    okText: t("partition.confirmOk"),
    okType: "danger",
    cancelText: t("partition.confirmCancel"),
    async onOk() {
      activeOp.value = "erase";
      try {
        await erasePartition(baudRate.value, p);
        message.success(t("partition.erasePartSuccess"));
      } catch (e) {
        handleOpsError(e, "partition.erasePartFailed");
        throw e;
      } finally {
        activeOp.value = "";
      }
    },
  });
}
</script>
<style scoped>
.device-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
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

.toolbar-fields {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 20px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.offset-input {
  width: 140px;
}

.baud-select {
  width: 140px;
}

.mono :deep(input) {
  font-family: Consolas, "Courier New", monospace;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.device-meta {
  font-size: 12px;
  color: #52c41a;
  white-space: nowrap;
}

.device-content {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.25fr);
  gap: 12px;
}

@media (max-width: 1100px) {
  .device-content {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .panel-charts,
  .panel-table {
    min-height: 280px;
  }
}

.panel-charts,
.panel-table {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.panel-charts {
  overflow: hidden;
}

.panel-charts .panel-body {
  overflow: auto;
  overflow-x: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-shrink: 0;
  margin-bottom: 10px;
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
  white-space: nowrap;
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.panel-table .panel-body > :deep(*) {
  height: 100%;
}

.panel-charts .panel-body > :deep(*) {
  height: auto;
  min-height: 100%;
}

.row-actions {
  display: inline-flex;
  align-items: center;
  gap: 0;
}

.row-actions :deep(.ant-btn-link) {
  height: 28px;
  padding: 0 6px;
  font-size: 13px;
  line-height: 28px;
}
</style>
