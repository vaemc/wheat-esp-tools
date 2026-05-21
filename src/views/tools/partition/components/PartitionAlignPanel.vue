<template>
  <a-row :gutter="24">
    <a-col :span="9">
      <section class="panel">
        <header class="panel-head">
          <span class="panel-title">{{ $t("partition.input") }}</span>
        </header>
        <p class="panel-hint">{{ $t("partition.alignHint") }}</p>
        <a-textarea
          v-model:value="inputCsv"
          :placeholder="$t('partition.inputPlaceholder')"
          :rows="20"
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
          :scroll="{ y: 280 }"
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
</template>
<script setup lang="ts">
import { usePartitionAlign } from "../composables/usePartitionAlign";
import { usePartitionColumns } from "../composables/usePartitionColumns";

const { inputCsv, error, result, copyOutput } = usePartitionAlign();
const { columns } = usePartitionColumns();
</script>
<style scoped>
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
  min-height: 120px;
  max-height: 200px;
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
