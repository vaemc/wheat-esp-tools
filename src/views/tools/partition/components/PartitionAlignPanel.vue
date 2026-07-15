<template>
  <div class="align-panel">
    <section class="toolbar panel">
      <div class="toolbar-main">
        <label class="field">
          <span class="field-label">{{ $t("partition.tableOffset") }}</span>
          <a-input
            v-model:value="tableOffset"
            placeholder="0x8000"
            class="offset-input mono"
            allow-clear
          />
        </label>
        <p class="toolbar-hint">{{ $t("partition.alignHint") }}</p>
      </div>
      <a-button
        type="primary"
        size="middle"
        :disabled="!result?.csv"
        @click="copyOutput"
      >
        {{ $t("partition.copy") }}
      </a-button>
    </section>

    <div class="align-content">
      <section class="panel panel-editor">
        <header class="panel-head">
          <span class="panel-title">{{ $t("partition.input") }}</span>
        </header>
        <div class="csv-wrap mono">
          <a-textarea
            v-model:value="inputCsv"
            :placeholder="$t('partition.inputPlaceholder')"
            allow-clear
            class="csv-input"
          />
        </div>
        <a-alert
          v-if="error"
          class="error-alert"
          type="error"
          show-icon
          :message="error"
        />
      </section>

      <section class="panel panel-preview">
        <header class="panel-head">
          <div class="panel-head-main">
            <span class="panel-title">{{ $t("partition.preview") }}</span>
            <span v-if="result" class="panel-meta">
              {{ $t("partition.flashUsage") }} {{ result.totalSizeMb }}
            </span>
          </div>
        </header>
        <div class="panel-body">
          <PartitionDetailTable
            :rows="result?.rows ?? []"
            :columns="columns"
            :empty-text="$t('partition.emptyPreview')"
            fill
          />
        </div>
      </section>
    </div>
  </div>
</template>
<script setup lang="ts">
import PartitionDetailTable from "./PartitionDetailTable.vue";
import { usePartitionAlign } from "../composables/usePartitionAlign";
import { usePartitionColumns } from "../composables/usePartitionColumns";

const { inputCsv, tableOffset, error, result, copyOutput } = usePartitionAlign();
const { columns } = usePartitionColumns();
</script>
<style scoped>
.align-panel {
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

.toolbar-main {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 20px;
  min-width: 0;
  flex: 1;
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

.toolbar-hint {
  margin: 0;
  flex: 1;
  min-width: 220px;
  font-size: 12px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.45);
}

.mono :deep(textarea),
.mono :deep(input) {
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  line-height: 1.5;
}

.align-content {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 12px;
}

@media (max-width: 1100px) {
  .align-content {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .panel-editor,
  .panel-preview {
    min-height: 320px;
  }
}

.panel-editor,
.panel-preview {
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

.csv-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
}

.csv-wrap :deep(.ant-input-textarea),
.csv-wrap :deep(.ant-input-affix-wrapper),
.csv-wrap :deep(textarea) {
  flex: 1;
  height: 100% !important;
  min-height: 220px;
}

.csv-wrap :deep(textarea) {
  resize: none;
}

.error-alert {
  flex-shrink: 0;
  margin-top: 8px;
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
