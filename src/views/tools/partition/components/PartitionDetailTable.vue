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
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key">
          <td v-for="col in columns" :key="col.key">
            {{ row[col.dataIndex] }}
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

defineProps<{
  rows: PartitionRow[];
  columns: PartitionDetailColumn[];
  emptyText: string;
  maxHeight?: number;
  /** 填满父级高度并内部滚动 */
  fill?: boolean;
}>();
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
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 13px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.85);
  user-select: text;
  -webkit-user-select: text;
}

.partition-detail-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 10px;
  text-align: left;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.65);
  background: #1f1f1f;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  white-space: nowrap;
  user-select: text;
  -webkit-user-select: text;
}

.partition-detail-table tbody td {
  padding: 7px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-family: Consolas, "Courier New", monospace;
  white-space: nowrap;
  user-select: text;
  -webkit-user-select: text;
  cursor: text;
}

.partition-detail-table tbody tr:last-child td {
  border-bottom: none;
}

.partition-detail-table tbody tr:hover td {
  background: rgba(255, 255, 255, 0.04);
}
</style>
