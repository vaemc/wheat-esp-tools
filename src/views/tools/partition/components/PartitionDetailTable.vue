<template>
  <div
    class="partition-detail-table-wrap"
    :class="{ 'is-fill': fill }"
    :style="maxHeight && !fill ? { maxHeight: `${maxHeight}px` } : undefined"
  >
    <table v-if="rows.length" class="partition-detail-table">
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            :style="col.width ? { width: `${col.width}px` } : undefined"
          >
            {{ col.title }}
          </th>
          <th v-if="showActions" class="actions-col">
            {{ actionsTitle }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="row.key">
          <td v-for="col in columns" :key="col.key">
            {{ row[col.dataIndex] }}
          </td>
          <td v-if="showActions" class="actions-cell">
            <slot name="actions" :row="row" :index="index" />
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty-wrap">
      <PlaceholderHint :text="emptyText" />
    </div>
  </div>
</template>
<script setup lang="ts">
import PlaceholderHint from "@/components/PlaceholderHint.vue";
import type { PartitionDetailColumn } from "../composables/usePartitionColumns";
import type { PartitionRow } from "@/utils/partitionTable";

withDefaults(
  defineProps<{
    rows: PartitionRow[];
    columns: PartitionDetailColumn[];
    emptyText: string;
    maxHeight?: number;
    /** 填满父级高度并内部滚动 */
    fill?: boolean;
    showActions?: boolean;
    actionsTitle?: string;
  }>(),
  {
    showActions: false,
    actionsTitle: "",
  }
);
</script>
<style scoped>
.partition-detail-table-wrap {
  overflow: auto;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.2);
  user-select: text;
  -webkit-user-select: text;
}

.partition-detail-table-wrap.is-fill {
  height: 100%;
}

.empty-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  height: 100%;
}

.partition-detail-table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 14px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.88);
  user-select: text;
  -webkit-user-select: text;
}

.partition-detail-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 12px 14px;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  background: #1f1f1f;
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
  white-space: nowrap;
  user-select: text;
  -webkit-user-select: text;
}

.partition-detail-table tbody td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-family: Consolas, "Courier New", monospace;
  font-size: 14px;
  white-space: nowrap;
  user-select: text;
  -webkit-user-select: text;
  cursor: text;
}

.partition-detail-table tbody tr:last-child td {
  border-bottom: none;
}

.partition-detail-table tbody tr:hover td {
  background: rgba(255, 255, 255, 0.05);
}

.actions-col {
  width: 200px;
}

.actions-cell {
  font-family: inherit !important;
  font-size: 13px !important;
  cursor: default !important;
  user-select: none !important;
  -webkit-user-select: none !important;
}
</style>
