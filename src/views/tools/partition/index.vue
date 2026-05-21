<template>
  <div class="partition-page">
    <a-row :gutter="24">
      <a-col :span="9">
        <section class="panel">
          <header class="panel-head">
            <span class="panel-title">{{ $t("partition.input") }}</span>
          </header>
          <p class="panel-hint">{{ $t("partition.inputHint") }}</p>
          <a-textarea
            v-model:value="inputCsv"
            :placeholder="$t('partition.inputPlaceholder')"
            :rows="24"
            allow-clear
            class="mono-input"
          />
          <a-alert
            v-if="error"
            class="error-alert"
            type="error"
            show-icon
            :message="error"
          />
        </section>
      </a-col>
      <a-col :span="15">
        <section class="panel">
          <header class="panel-head">
            <span class="panel-title">{{ $t("partition.preview") }}</span>
            <span v-if="result" class="panel-meta">
              {{ $t("partition.flashUsage") }} {{ result.totalSizeMb }}
            </span>
          </header>
          <a-table
            :bordered="true"
            :pagination="false"
            size="small"
            :scroll="{ y: 220 }"
            :data-source="result?.rows ?? []"
            :columns="columns"
            :locale="{ emptyText: $t('partition.emptyPreview') }"
          />
        </section>
        <section class="panel panel-output">
          <header class="panel-head">
            <span class="panel-title">{{ $t("partition.output") }}</span>
            <a-button
            
              size="small"
              type="text"
              :disabled="!result?.csv"
              @click="copyOutput"
            >
              {{ $t("partition.copy") }}
            </a-button>
          </header>
          <pre class="csv-output">{{ result?.csv || $t("partition.emptyOutput") }}</pre>
        </section>
      </a-col>
    </a-row>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "ant-design-vue";
import {
  buildPartitionTable,
  PartitionTableError,
} from "@/utils/partitionTable";

const { t } = useI18n();

const defaultCsv = `# Name, Type, SubType, Offset, Size, Flags
nvs, data, nvs, , 0x6000,
otadata, data, ota, , 0x2000,
phy_init, data, phy, , 0x1000,
factory, app, factory, , 1M,
`;

const inputCsv = ref(defaultCsv);
const error = ref<string | null>(null);

const result = computed(() => {
  const text = inputCsv.value?.trim();
  if (!text) {
    error.value = null;
    return null;
  }
  try {
    const table = buildPartitionTable(inputCsv.value);
    error.value = null;
    return table;
  } catch (e) {
    error.value =
      e instanceof PartitionTableError
        ? e.message
        : t("partition.parseError");
    return null;
  }
});

const columns = computed(() => [
  { title: t("partition.colName"), dataIndex: "name", key: "name", width: 88 },
  { title: t("partition.colType"), dataIndex: "type", key: "type", width: 56 },
  {
    title: t("partition.colSubType"),
    dataIndex: "subtype",
    key: "subtype",
    width: 72,
  },
  {
    title: t("partition.colOffset"),
    dataIndex: "offset",
    key: "offset",
    width: 80,
  },
  { title: t("partition.colSize"), dataIndex: "size", key: "size", width: 64 },
  { title: t("partition.colFlags"), dataIndex: "flags", key: "flags" },
]);

async function copyOutput() {
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
.partition-page {
  padding: 12px 16px;
}
.panel {
  margin-bottom: 16px;
}
.panel-output {
  margin-bottom: 0;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
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
.mono-input :deep(textarea) {
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  line-height: 1.5;
}
.error-alert {
  margin-top: 8px;
}
.csv-output {
  margin: 0;
  padding: 12px;
  min-height: 200px;
  max-height: 280px;
  overflow: auto;
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  white-space: pre;
}
</style>
