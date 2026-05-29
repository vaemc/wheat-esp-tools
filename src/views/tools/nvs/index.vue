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
        <a-button :loading="loading" @click="onGenerateFromCsv">
          {{ $t("nvs.generateFromCsv") }}
        </a-button>
      </div>
    </section>

    <section class="panel">
      <header class="panel-head">
        <span class="panel-title">{{ $t("nvs.keyValueList") }}</span>
        <span class="panel-meta">
          <span>{{ filteredRows.length }} {{ $t("nvs.itemUnit") }}</span>
          <span v-if="pendingEditCount > 0" class="pending-tag">
            {{ $t("nvs.pendingChanges", { n: pendingEditCount }) }}
          </span>
        </span>
      </header>
      <a-input-search
        v-model:value="keyword"
        :placeholder="$t('nvs.search')"
        allow-clear
        class="panel-search"
      />

      <div v-if="rows.length > 0" class="edit-toolbar">
        <a-button
          type="primary"
          danger
          :disabled="!canWriteBack || pendingEditCount === 0 || loading"
          :loading="writing"
          @click="onWriteBack"
        >
          {{ $t("nvs.writeBack") }}
        </a-button>
        <a-button
          :disabled="pendingEditCount === 0 || loading || writing"
          @click="onSaveAsBin"
        >
          {{ $t("nvs.saveAsBin") }}
        </a-button>
        <a-button
          :disabled="pendingEditCount === 0 || loading || writing"
          @click="onRevertAll"
        >
          {{ $t("nvs.revertAll") }}
        </a-button>
        <span v-if="!canWriteBack && rows.length > 0" class="edit-hint">
          {{ $t("nvs.writeBackDisabledHint") }}
        </span>
      </div>

      <a-table
        :bordered="true"
        :pagination="{ pageSize: 15, size: 'small', hideOnSinglePage: true }"
        size="small"
        :loading="loading"
        :data-source="filteredRows"
        :columns="columns"
        :row-class-name="rowClassName"
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
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, h, ref } from "vue";
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
        // 结构化错误码：精确文案
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
        // 任何其它错误：把真实信息打到 console + 弹窗末尾，方便后续诊断
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
.edit-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.edit-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}
.mono :deep(input) {
  font-family: Consolas, "Courier New", monospace;
}
.value-input :deep(input) {
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
</style>
