<template>
  <div class="nvs-page">
    <section class="panel">
      <header class="panel-head">
        <span class="panel-title">{{ $t("nvs.readOptions") }}</span>
      </header>
      <p v-if="detectedInfo" class="detected-info">{{ detectedInfo }}</p>
      <p v-else class="panel-hint">{{ $t("nvs.detectHint") }}</p>
      <div class="options-row">
        <label class="option-field">
          <span class="option-label">{{ $t("nvs.offset") }}</span>
          <a-input
            v-model:value="offset"
            placeholder="0x9000"
            class="mono"
            :disabled="loading"
          />
        </label>
        <label class="option-field">
          <span class="option-label">{{ $t("nvs.size") }}</span>
          <a-input
            v-model:value="size"
            placeholder="0x6000"
            class="mono"
            :disabled="loading"
          />
        </label>
        <label class="option-field">
          <span class="option-label">{{ $t("nvs.baudRate") }}</span>
          <a-select v-model:value="baudRate" :options="baudOptions" />
        </label>
      </div>
      <div class="action-row">
        <a-button
          type="primary"
          :loading="loading"
          @click="onReadDevice"
        >
          {{ $t("nvs.readFromDevice") }}
        </a-button>
        <a-button :loading="loading" @click="onOpenFile">
          {{ $t("nvs.openFile") }}
        </a-button>
      </div>
    </section>

    <section class="panel">
      <header class="panel-head">
        <span class="panel-title">{{ $t("nvs.keyValueList") }}</span>
        <span class="panel-meta">{{ filteredRows.length }} {{ $t("nvs.itemUnit") }}</span>
      </header>
      <a-input-search
        v-model:value="keyword"
        :placeholder="$t('nvs.search')"
        allow-clear
        class="panel-search"
      />
      <a-table
        :bordered="true"
        :pagination="{ pageSize: 15, size: 'small', hideOnSinglePage: true }"
        size="small"
        :loading="loading"
        :data-source="filteredRows"
        :columns="columns"
        :scroll="{ y: 420 }"
        :locale="{ emptyText: $t('nvs.emptyList') }"
        row-key="rowKey"
      />
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "ant-design-vue";
import { useNvsReader } from "./composables/useNvsReader";

const { t } = useI18n();

const {
  loading,
  rows,
  keyword,
  offset,
  size,
  baudRate,
  detectedInfo,
  readFromDevice,
  openLocalFile,
} = useNvsReader();

const baudOptions = ["115200", "230400", "460800", "921600"].map((v) => ({
  label: v,
  value: v,
}));

const filteredRows = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  const list = rows.value.map((r, i) => ({
    ...r,
    rowKey: `${r.namespace}:${r.key}:${i}`,
  }));
  if (!q) {
    return list;
  }
  return list.filter(
    (r) =>
      r.namespace.toLowerCase().includes(q) ||
      r.key.toLowerCase().includes(q) ||
      r.value.toLowerCase().includes(q)
  );
});

const columns = computed(() => [
  {
    title: t("nvs.colNamespace"),
    dataIndex: "namespace",
    key: "namespace",
    width: 120,
    ellipsis: true,
  },
  { title: t("nvs.colKey"), dataIndex: "key", key: "key", width: 140, ellipsis: true },
  {
    title: t("nvs.colType"),
    dataIndex: "value_type",
    key: "value_type",
    width: 88,
  },
  { title: t("nvs.colValue"), dataIndex: "value", key: "value", ellipsis: true },
]);

function handleReadError(e: unknown) {
  if (e instanceof Error && e.message === "NO_PORT") {
    message.warning(t("nvs.noPort"));
  } else if (e instanceof Error && e.message === "NO_NVS") {
    message.warning(t("nvs.noNvsPartition"));
  } else if (e instanceof Error && e.message === "READ_FAILED") {
    message.error(t("nvs.readFailed"));
  } else {
    message.error(t("nvs.readFailed"));
  }
}

async function onReadDevice() {
  try {
    await readFromDevice();
    if (detectedInfo.value) {
      message.success(t("nvs.readSuccess", { info: detectedInfo.value }));
    }
    if (rows.value.length === 0) {
      message.info(t("nvs.emptyParsed"));
    }
  } catch (e) {
    handleReadError(e);
  }
}

async function onOpenFile() {
  try {
    await openLocalFile();
    if (rows.value.length === 0) {
      message.info(t("nvs.emptyParsed"));
    }
  } catch {
    message.error(t("nvs.parseFailed"));
  }
}
</script>
<style scoped>
.nvs-page {
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
.panel-search {
  margin-bottom: 10px;
}
.options-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  margin-bottom: 12px;
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
.action-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.mono :deep(input) {
  font-family: Consolas, "Courier New", monospace;
}
.panel-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}
.detected-info {
  margin: 0 0 8px;
  font-size: 12px;
  color: #52c41a;
}
</style>
