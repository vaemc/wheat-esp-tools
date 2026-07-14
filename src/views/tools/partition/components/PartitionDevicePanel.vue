<template>
  <div class="device-panel">
    <section class="device-bar panel">
      <a-button
        type="primary"
        :loading="loading"
        @click="onReadFromDevice"
      >
        {{ $t("partition.readFromDevice") }}
      </a-button>
      <label class="baud-field">
        <span>{{ $t("partition.tableOffset") }}</span>
        <a-input
          v-model:value="tableOffset"
          placeholder="0x8000"
          class="offset-input mono"
          :disabled="loading"
        />
      </label>
      <label class="baud-field">
        <span>{{ $t("partition.baudRate") }}</span>
        <a-select
          v-model:value="baudRate"
          :options="baudOptions"
          style="width: 110px"
        />
      </label>
      <span v-if="partitions.length" class="device-meta">
        {{ $t("partition.deviceCount", { n: partitions.length }) }}
      </span>
    </section>

    <section class="panel">
      <header class="panel-head">
        <span class="panel-title">{{ $t("partition.layout") }}</span>
      </header>
      <PartitionCharts
        :partitions="partitions"
        :empty-text="$t('partition.emptyDeviceCharts')"
      />
    </section>

    <section class="panel panel-last">
      <header class="panel-head">
        <span class="panel-title">{{ $t("partition.preview") }}</span>
        <span v-if="result" class="panel-meta">
          {{ $t("partition.flashUsage") }} {{ result.totalSizeMb }}
        </span>
        <a-button
          v-if="result?.csv"
          size="small"
          type="text"
          @click="copyCsv"
        >
          {{ $t("partition.copy") }}
        </a-button>
      </header>
      <PartitionDetailTable
        :rows="result?.rows ?? []"
        :columns="columns"
        :empty-text="$t('partition.emptyDevicePreview')"
        :max-height="280"
      />
    </section>
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
import { READ_BAUD_RATE_OPTIONS, toBaudSelectOptions } from "@/composables/useFlashOptions";
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
  padding-top: 4px;
}
.device-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
}
.baud-field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}
.offset-input {
  width: 110px;
}
.mono :deep(input) {
  font-family: Consolas, "Courier New", monospace;
}
.device-meta {
  font-size: 12px;
  color: #52c41a;
}
.panel {
  margin-bottom: 16px;
}
.panel-last {
  margin-bottom: 0;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.panel-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.88);
  margin-right: auto;
}
.panel-meta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}
</style>
