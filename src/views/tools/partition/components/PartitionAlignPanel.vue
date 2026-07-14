<template>
  <a-row :gutter="24">
    <a-col :span="9">
      <section class="panel">
        <header class="panel-head">
          <span class="panel-title">{{ $t("partition.input") }}</span>
        </header>
        <p class="panel-hint">{{ $t("partition.alignHint") }}</p>
        <label class="offset-field">
          <span class="offset-label">{{ $t("partition.tableOffset") }}</span>
          <a-input
            v-model:value="tableOffset"
            placeholder="0x8000"
            class="offset-input mono-input"
            allow-clear
          />
        </label>
        <a-textarea
          v-model:value="inputCsv"
          :placeholder="$t('partition.inputPlaceholder')"
          :rows="18"
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
      <section class="panel panel-table">
        <header class="panel-head">
          <div class="panel-head-left">
            <span class="panel-title">{{ $t("partition.preview") }}</span>
            <span v-if="result" class="panel-meta">
              {{ $t("partition.flashUsage") }} {{ result.totalSizeMb }}
            </span>
          </div>
          <a-button
            size="small"
            :disabled="!result?.csv"
            @click="copyOutput"
          >
            {{ $t("partition.copy") }}
          </a-button>
        </header>
        <PartitionDetailTable
          :rows="result?.rows ?? []"
          :columns="columns"
          :empty-text="$t('partition.emptyPreview')"
        />
      </section>
    </a-col>
  </a-row>
</template>
<script setup lang="ts">
import PartitionDetailTable from "./PartitionDetailTable.vue";
import { usePartitionAlign } from "../composables/usePartitionAlign";
import { usePartitionColumns } from "../composables/usePartitionColumns";

const { inputCsv, tableOffset, error, result, copyOutput } = usePartitionAlign();
const { columns } = usePartitionColumns();
</script>
<style scoped>
.panel {
  margin-bottom: 16px;
}
.panel-table {
  margin-bottom: 0;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.panel-head-left {
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
.panel-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.5;
}
.offset-field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.offset-label {
  flex-shrink: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}
.offset-input {
  width: 140px;
}
.mono-input :deep(textarea),
.mono-input :deep(input) {
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  line-height: 1.5;
}
.error-alert {
  margin-top: 8px;
}
</style>
