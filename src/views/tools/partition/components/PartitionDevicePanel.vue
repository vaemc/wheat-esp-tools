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
            :disabled="loading"
            allow-clear
          />
        </label>
        <label class="field">
          <span class="field-label">{{ $t("partition.baudRate") }}</span>
          <a-select
            v-model:value="baudRate"
            class="baud-select"
            :options="baudOptions"
            :disabled="loading"
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
            :disabled="!result?.csv"
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
            fill
          />
        </div>
      </section>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { message } from "ant-design-vue";
import PartitionCharts from "@/components/PartitionCharts.vue";
import PartitionDetailTable from "./PartitionDetailTable.vue";
import { usePartitionFromDevice } from "../composables/usePartitionFromDevice";
import { usePartitionColumns } from "../composables/usePartitionColumns";
import {
  READ_BAUD_RATE_OPTIONS,
  toBaudSelectOptions,
} from "@/composables/useFlashOptions";
import { usePartitionTableStore } from "@/stores/partitionTable";

const { t } = useI18n();
const baudRate = ref("460800");
const { tableOffset } = storeToRefs(usePartitionTableStore());
const baudOptions = toBaudSelectOptions(READ_BAUD_RATE_OPTIONS);
const { loading, partitions, result, readFromDevice } = usePartitionFromDevice();
const { columns } = usePartitionColumns();

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
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
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

.panel-body > :deep(*) {
  height: 100%;
}
</style>
