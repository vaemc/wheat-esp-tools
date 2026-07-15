<template>
  <div class="nvs-page">
    <section class="toolbar panel">
      <div class="toolbar-main">
        <div class="toolbar-fields">
          <label class="field">
            <span class="field-label">{{ $t("nvs.tableOffset") }}</span>
            <a-input
              v-model:value="tableOffset"
              placeholder="0x8000"
              class="offset-input mono"
              :disabled="loading"
              allow-clear
            />
          </label>
          <label class="field">
            <span class="field-label">{{ $t("nvs.offset") }}</span>
            <a-input
              v-model:value="offset"
              placeholder="0x9000"
              class="offset-input mono"
              :disabled="loading"
              allow-clear
            />
          </label>
          <label class="field">
            <span class="field-label">{{ $t("nvs.size") }}</span>
            <a-input
              v-model:value="size"
              placeholder="0x6000"
              class="offset-input mono"
              :disabled="loading"
              allow-clear
            />
          </label>
          <label class="field">
            <span class="field-label">{{ $t("nvs.baudRate") }}</span>
            <a-select
              v-model:value="baudRate"
              class="baud-select"
              :options="baudOptions"
              :disabled="loading"
            />
          </label>
        </div>
        <p v-if="detectedInfo" class="detected-info">{{ detectedInfo }}</p>
        <p v-else class="toolbar-hint">{{ $t("nvs.detectHint") }}</p>
      </div>
      <div class="toolbar-actions">
        <a-button type="primary" :loading="loading" @click="onReadDevice">
          {{ $t("nvs.readFromDevice") }}
        </a-button>
        <a-button :loading="loading" @click="onOpenFile">
          {{ $t("nvs.openFile") }}
        </a-button>
        <a-button :loading="loading" @click="onGenerateFromCsv">
          {{ $t("nvs.generateFromCsv") }}
        </a-button>
      </div>
    </section>

    <section class="panel panel-list">
      <header class="panel-head">
        <div class="panel-head-main">
          <span class="panel-title">{{ $t("nvs.keyValueList") }}</span>
          <span class="panel-meta">
            <span>{{ filteredRows.length }} {{ $t("nvs.itemUnit") }}</span>
            <span v-if="pendingEditCount > 0" class="pending-tag">
              {{ $t("nvs.pendingChanges", { n: pendingEditCount }) }}
            </span>
          </span>
        </div>
        <div v-if="rows.length > 0" class="edit-toolbar">
          <a-button
            type="primary"
            danger
            size="small"
            :disabled="!canWriteBack || pendingEditCount === 0 || loading"
            :loading="writing"
            @click="onWriteBack"
          >
            {{ $t("nvs.writeBack") }}
          </a-button>
          <a-button
            size="small"
            :disabled="pendingEditCount === 0 || loading || writing"
            @click="onSaveAsBin"
          >
            {{ $t("nvs.saveAsBin") }}
          </a-button>
          <a-button
            size="small"
            :disabled="pendingEditCount === 0 || loading || writing"
            @click="onRevertAll"
          >
            {{ $t("nvs.revertAll") }}
          </a-button>
        </div>
      </header>

      <a-input-search
        v-model:value="keyword"
        :placeholder="$t('nvs.search')"
        allow-clear
        class="panel-search"
      />

      <p
        v-if="!canWriteBack && rows.length > 0"
        class="edit-hint"
      >
        {{ $t("nvs.writeBackDisabledHint") }}
      </p>

      <div ref="tableWrapRef" class="table-wrap">
        <a-table
          :bordered="true"
          :pagination="{ pageSize: 20, size: 'small', hideOnSinglePage: true }"
          size="small"
          :loading="loading"
          :data-source="filteredRows"
          :columns="columns"
          :row-class-name="rowClassName"
          :scroll="{ y: tableScrollY }"
          row-key="rowKey"
        >
          <template #emptyText>
            <PlaceholderHint :text="$t('nvs.emptyList')" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'value'">
              <a-input
                v-if="!record.is_binary && !record.isDeleted"
                :value="record.value"
                size="small"
                class="value-input mono"
                :title="record.value"
                @change="(e: ChangeEvent) => onValueChange(record, e.target?.value ?? '')"
              />
              <span
                v-else
                v-copy="record.value"
                class="nvs-copy-cell"
                :title="record.is_binary ? $t('nvs.binaryReadonly') : record.value"
              >
                {{ record.value }}
                <span v-if="record.is_binary" class="binary-tag">BIN</span>
              </span>
            </template>
            <template v-else-if="column.key === 'actions'">
              <span class="row-actions">
                <a-button
                  v-if="!record.isDeleted"
                  size="small"
                  type="link"
                  danger
                  :disabled="record.isNew"
                  @click="onMarkDelete(record)"
                >
                  {{ $t("nvs.actionDelete") }}
                </a-button>
                <a-button
                  v-else
                  size="small"
                  type="link"
                  @click="onUndoDelete(record)"
                >
                  {{ $t("nvs.actionUndoDelete") }}
                </a-button>
                <a-button
                  size="small"
                  type="link"
                  :disabled="!isRowDirty(record)"
                  @click="onRevertRow(record)"
                >
                  {{ $t("nvs.actionRevert") }}
                </a-button>
              </span>
            </template>
            <template v-else>
              <span
                v-copy="record[column.dataIndex]"
                class="nvs-copy-cell"
                :title="String(record[column.dataIndex] ?? '')"
              >
                {{ record[column.dataIndex] }}
              </span>
            </template>
          </template>
        </a-table>
      </div>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, h, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Modal, message } from "ant-design-vue";
import PlaceholderHint from "@/components/PlaceholderHint.vue";
import { READ_BAUD_RATE_OPTIONS, toBaudSelectOptions } from "@/composables/useFlashOptions";
import { useNvsReader, type NvsEditableRow } from "./composables/useNvsReader";

interface ChangeEvent {
  target?: { value?: string };
}

interface DisplayRow extends NvsEditableRow {
  rowKey: string;
}

const { t } = useI18n();

const {
  loading,
  rows,
  originalRows,
  keyword,
  tableOffset,
  offset,
  size,
  baudRate,
  detectedInfo,
  sourceIsDevice,
  pendingEditCount,
  rowKey,
  readFromDevice,
  openLocalFile,
  setRowValue,
  toggleRowDeleted,
  revertRow,
  revertAll,
  rebuildToFile,
  writeBackToDevice,
  generateFromCsv,
} = useNvsReader();

const baudOptions = toBaudSelectOptions(READ_BAUD_RATE_OPTIONS);
const writing = ref(false);
const tableScrollY = ref(360);
const tableWrapRef = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | undefined;

const filteredRows = computed<DisplayRow[]>(() => {
  const q = keyword.value.trim().toLowerCase();
  const list = rows.value.map<DisplayRow>((r) => ({
    ...r,
    rowKey: rowKey(r),
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

const canWriteBack = computed(() => sourceIsDevice.value && rows.value.length > 0);

function isRowDirty(record: NvsEditableRow): boolean {
  if (record.isDeleted) return true;
  if (record.isNew) return true;
  const orig = originalRows.value[record.originalIndex];
  if (!orig) return false;
  return orig.value !== record.value || orig.value_type !== record.value_type;
}

function rowClassName(record: NvsEditableRow): string {
  if (record.isDeleted) return "row-deleted";
  if (record.isNew) return "row-new";
  if (isRowDirty(record)) return "row-edited";
  return "";
}

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
  { title: t("nvs.colActions"), key: "actions", width: 132, fixed: "right" as const },
]);

function updateTableScrollY() {
  const el = tableWrapRef.value;
  if (!el) return;
  const header = el.querySelector(".ant-table-header, .ant-table-thead") as HTMLElement | null;
  const pagination = el.querySelector(".ant-table-pagination") as HTMLElement | null;
  const headerH = header?.offsetHeight ?? 39;
  let paginationH = 0;
  if (pagination) {
    const style = getComputedStyle(pagination);
    paginationH =
      pagination.offsetHeight +
      (parseFloat(style.marginTop) || 0) +
      (parseFloat(style.marginBottom) || 0);
  }
  // borders / rounding buffer
  const reserved = headerH + paginationH + 4;
  tableScrollY.value = Math.max(160, el.clientHeight - reserved);
}

onMounted(() => {
  void nextTick(() => updateTableScrollY());
  if (tableWrapRef.value) {
    resizeObserver = new ResizeObserver(() => {
      void nextTick(() => updateTableScrollY());
    });
    resizeObserver.observe(tableWrapRef.value);
  }
  window.addEventListener("resize", updateTableScrollY);
});

watch(
  () => filteredRows.value.length,
  () => {
    void nextTick(() => updateTableScrollY());
  }
);

onUnmounted(() => {
  resizeObserver?.disconnect();
  window.removeEventListener("resize", updateTableScrollY);
});

function handleReadError(e: unknown) {
  if (e instanceof Error && e.message === "NO_PORT") {
    message.warning(t("nvs.noPort"));
  } else if (e instanceof Error && e.message === "BAD_TABLE_OFFSET") {
    message.warning(t("nvs.badTableOffset"));
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

async function onGenerateFromCsv() {
  try {
    const summary = await generateFromCsv();
    if (summary) {
      message.success(t("nvs.generatedSuccess", { path: summary.save_path }));
    }
  } catch (e) {
    if (e instanceof Error && e.message === "BAD_SIZE") {
      message.error(t("nvs.badSize"));
    } else {
      message.error(t("nvs.generateFailed"));
    }
  }
}

function onValueChange(record: NvsEditableRow, next: string) {
  setRowValue(rowKey(record), next);
}

function onMarkDelete(record: NvsEditableRow) {
  toggleRowDeleted(rowKey(record), true);
}

function onUndoDelete(record: NvsEditableRow) {
  toggleRowDeleted(rowKey(record), false);
}

function onRevertRow(record: NvsEditableRow) {
  revertRow(rowKey(record));
}

function onRevertAll() {
  revertAll();
}

async function onSaveAsBin() {
  try {
    const summary = await rebuildToFile();
    message.success(t("nvs.saveAsBinSuccess", { path: summary.save_path }));
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "NO_EDITS") {
        message.info(t("nvs.noEdits"));
        return;
      }
      if (e.message === "NO_SOURCE") {
        message.warning(t("nvs.noSource"));
        return;
      }
      if (e.message === "BAD_SIZE") {
        message.error(t("nvs.badSize"));
        return;
      }
    }
    message.error(t("nvs.rebuildFailed"));
  }
}

async function onWriteBack() {
  if (!canWriteBack.value) {
    message.warning(t("nvs.writeBackDisabledHint"));
    return;
  }
  if (pendingEditCount.value === 0) {
    message.info(t("nvs.noEdits"));
    return;
  }
  Modal.confirm({
    title: t("nvs.confirmWriteTitle"),
    content: () =>
      h("div", null, [
        h("p", { style: "margin: 0 0 6px;" }, t("nvs.confirmWriteIntro")),
        h(
          "ul",
          { style: "margin: 0; padding-left: 18px; line-height: 1.8;" },
          [
            h("li", null, [
              h("b", null, t("nvs.offset") + ": "),
              h("span", { class: "mono" }, offset.value),
            ]),
            h("li", null, [
              h("b", null, t("nvs.size") + ": "),
              h("span", { class: "mono" }, size.value),
            ]),
            h("li", null, [
              h("b", null, t("nvs.pendingChangesShort") + ": "),
              h("span", null, String(pendingEditCount.value)),
            ]),
          ]
        ),
        h(
          "p",
          { style: "margin: 8px 0 0; color: #fa8c16; font-size: 12px;" },
          t("nvs.confirmWriteWarn")
        ),
      ]),
    okText: t("nvs.confirmWriteOk"),
    okButtonProps: { danger: true },
    cancelText: t("nvs.confirmWriteCancel"),
    onOk: async () => {
      writing.value = true;
      try {
        const result = await writeBackToDevice();
        message.success(
          t("nvs.writeBackSuccess", {
            count: result.summary.entries,
            offset: result.offset,
          })
        );
      } catch (e) {
        const code =
          e instanceof Error
            ? e.message
            : typeof e === "string"
              ? e
              : "";
        if (code === "NO_PORT") {
          message.warning(t("nvs.noPort"));
          return;
        }
        if (code === "NOT_FROM_DEVICE") {
          message.warning(t("nvs.writeBackDisabledHint"));
          return;
        }
        if (code === "NO_EDITS") {
          message.info(t("nvs.noEdits"));
          return;
        }
        console.error("[NVS] write-back failed:", e);
        const detail =
          e instanceof Error
            ? e.message
            : typeof e === "string"
              ? e
              : (() => {
                  try {
                    return JSON.stringify(e);
                  } catch {
                    return String(e);
                  }
                })();
        message.error(`${t("nvs.writeBackFailed")}: ${detail}`);
      } finally {
        writing.value = false;
      }
    },
  });
}
</script>
<style scoped>
.nvs-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  padding: 12px 16px;
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
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.toolbar-fields {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 16px;
}

.toolbar-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.45);
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-left: auto;
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

.offset-input,
.baud-select {
  width: 140px;
}

.detected-info {
  margin: 0;
  font-size: 12px;
  color: #52c41a;
}

.panel-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
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
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.pending-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  background: rgba(250, 140, 22, 0.18);
  color: #fa8c16;
  border: 1px solid rgba(250, 140, 22, 0.4);
  font-size: 11px;
}

.edit-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.panel-search {
  flex-shrink: 0;
  margin-bottom: 8px;
  max-width: 420px;
}

.edit-hint {
  flex-shrink: 0;
  margin: 0 0 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.mono :deep(input) {
  font-family: Consolas, "Courier New", monospace;
}

.value-input :deep(input) {
  font-family: Consolas, "Courier New", monospace;
}

.nvs-copy-cell {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.nvs-copy-cell:hover {
  color: rgba(255, 255, 255, 0.95);
}

.binary-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 0 6px;
  font-size: 10px;
  line-height: 14px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.55);
  vertical-align: middle;
}

.row-actions {
  display: inline-flex;
  align-items: center;
  gap: 0;
}

:deep(.row-edited) td {
  background: rgba(250, 173, 20, 0.08) !important;
}

:deep(.row-deleted) td {
  background: rgba(255, 77, 79, 0.1) !important;
  text-decoration: line-through;
  color: rgba(255, 255, 255, 0.5);
}

:deep(.row-new) td {
  background: rgba(82, 196, 26, 0.1) !important;
}

/* 分页与表头在 flex 中占位，body 用 scroll.y 滚动，避免底部裁切 */
.table-wrap :deep(.ant-table-wrapper),
.table-wrap :deep(.ant-spin-nested-loading),
.table-wrap :deep(.ant-spin-container) {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.table-wrap :deep(.ant-table) {
  flex: 1;
  min-height: 0;
}

.table-wrap :deep(.ant-table-pagination) {
  flex-shrink: 0;
  margin-bottom: 0 !important;
}
</style>
