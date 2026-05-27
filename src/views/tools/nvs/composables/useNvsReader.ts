import { computed, ref } from "vue";
import { open } from "@tauri-apps/api/dialog";
import { readBinaryFile } from "@tauri-apps/api/fs";
import moment from "moment";
import { getCurrentDir } from "@/utils/common";
import { runEsptoolReadFlash } from "@/utils/esptoolRead";
import { runEsptoolWriteFlash } from "@/utils/esptoolWrite";
import {
  findNvsPartition,
  formatHexDisplay,
  formatHexForEsptool,
  parseSizeParam,
  parsePartitionTableBinary,
} from "@/utils/partitionBin";
import {
  DEFAULT_OFFSET_PART_TABLE,
  PARTITION_TABLE_SIZE,
} from "@/utils/partitionTable";
import {
  generateNvsFromCsv,
  parseNvsPartition,
  rebuildNvsPartition,
  type NvsEdit,
  type NvsKeyValue,
  type NvsRebuildSummary,
} from "@/utils/nvs";

export interface NvsEditableRow extends NvsKeyValue {
  /** 与 originalRows 中对应条目的下标（用于 diff） */
  originalIndex: number;
  /** 是否为新增行 */
  isNew: boolean;
  /** 是否被标记删除 */
  isDeleted: boolean;
}

const ROW_KEY_SEP = "\u0000";

function rowKey(row: { namespace: string; key: string }): string {
  return `${row.namespace}${ROW_KEY_SEP}${row.key}`;
}

export function useNvsReader() {
  const loading = ref(false);
  /** 用户表格里看到的、可编辑的当前快照 */
  const rows = ref<NvsEditableRow[]>([]);
  /** 读取后立即冻结的副本，作为 diff 基准 */
  const originalRows = ref<NvsKeyValue[]>([]);
  /** 当前 NVS 二进制在磁盘上的路径，用于写回时作为重建的基准 */
  const nvsBinPath = ref("");
  /** 标记 nvsBinPath 是否来自设备读取（仅设备来源允许直接烧录回去） */
  const sourceIsDevice = ref(false);

  const keyword = ref("");
  const offset = ref("0x9000");
  const size = ref("0x6000");
  const baudRate = ref("460800");
  const detectedInfo = ref("");

  /** 已修改 / 已删除 / 新增行的总数 */
  const pendingEditCount = computed(() => {
    let count = 0;
    for (const row of rows.value) {
      if (row.isDeleted) {
        count += 1;
        continue;
      }
      if (row.isNew) {
        count += 1;
        continue;
      }
      const orig = originalRows.value[row.originalIndex];
      if (!orig) {
        continue;
      }
      if (orig.value !== row.value || orig.value_type !== row.value_type) {
        count += 1;
      }
    }
    return count;
  });

  function buildEdits(): NvsEdit[] {
    const edits: NvsEdit[] = [];
    for (const row of rows.value) {
      if (row.isDeleted && !row.isNew) {
        edits.push({
          op: "delete",
          namespace: row.namespace,
          key: row.key,
        });
        continue;
      }
      if (row.isDeleted && row.isNew) {
        // 新增后又删除：忽略
        continue;
      }
      if (row.isNew) {
        edits.push({
          op: "add",
          namespace: row.namespace,
          key: row.key,
          value_type: row.value_type,
          value: row.value,
        });
        continue;
      }
      const orig = originalRows.value[row.originalIndex];
      if (!orig) {
        continue;
      }
      if (orig.value !== row.value || orig.value_type !== row.value_type) {
        edits.push({
          op: "update",
          namespace: row.namespace,
          key: row.key,
          value_type: row.value_type,
          value: row.value,
        });
      }
    }
    return edits;
  }

  /** 从设备读取分区表并填充 NVS 偏移/大小 */
  async function detectNvsPartitionFromDevice(port: string): Promise<void> {
    const dir = await getCurrentDir();
    const ptPath = `${dir}\\partitions\\pt-read-${moment().valueOf()}.bin`;

    await runEsptoolReadFlash(
      port,
      baudRate.value,
      formatHexForEsptool(DEFAULT_OFFSET_PART_TABLE),
      formatHexForEsptool(PARTITION_TABLE_SIZE),
      ptPath
    );

    const buffer = await readBinaryFile(ptPath);
    const partitions = parsePartitionTableBinary(new Uint8Array(buffer));
    const nvs = findNvsPartition(partitions);

    if (!nvs) {
      detectedInfo.value = "";
      throw new Error("NO_NVS");
    }

    offset.value = formatHexForEsptool(nvs.offset);
    size.value = formatHexForEsptool(nvs.size);
    detectedInfo.value = `${nvs.name} @ ${formatHexDisplay(nvs.offset)}, ${formatHexDisplay(nvs.size)}`;
  }

  function applyParsed(parsed: NvsKeyValue[], path: string, fromDevice: boolean) {
    nvsBinPath.value = path;
    sourceIsDevice.value = fromDevice;
    originalRows.value = parsed.map((r) => ({ ...r }));
    rows.value = parsed.map((r, i) => ({
      ...r,
      originalIndex: i,
      isNew: false,
      isDeleted: false,
    }));
  }

  async function parseFile(path: string, fromDevice: boolean) {
    const parsed = await parseNvsPartition(path);
    applyParsed(parsed, path, fromDevice);
  }

  /** 检测 NVS 分区后读取并解析 */
  async function readFromDevice() {
    const port = localStorage.getItem("port");
    if (!port) {
      throw new Error("NO_PORT");
    }

    loading.value = true;
    rows.value = [];
    originalRows.value = [];

    try {
      await detectNvsPartitionFromDevice(port);

      const dir = await getCurrentDir();
      const savePath = `${dir}\\nvs\\nvs-${moment().valueOf()}.bin`;

      await runEsptoolReadFlash(
        port,
        baudRate.value,
        offset.value,
        size.value,
        savePath
      );
      await parseFile(savePath, true);
    } finally {
      loading.value = false;
    }
  }

  async function openLocalFile() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "NVS Binary", extensions: ["bin"] }],
    });
    if (typeof selected !== "string") {
      return;
    }

    loading.value = true;
    try {
      await parseFile(selected, false);
    } finally {
      loading.value = false;
    }
  }

  /** 用户在表格里编辑一个值，返回是否成功标记 */
  function setRowValue(rk: string, nextValue: string): boolean {
    const row = rows.value.find((r) => rowKey(r) === rk);
    if (!row || row.isDeleted || row.is_binary) {
      return false;
    }
    row.value = nextValue;
    return true;
  }

  function toggleRowDeleted(rk: string, deleted: boolean) {
    const row = rows.value.find((r) => rowKey(r) === rk);
    if (!row) {
      return;
    }
    row.isDeleted = deleted;
  }

  function revertRow(rk: string) {
    const row = rows.value.find((r) => rowKey(r) === rk);
    if (!row) {
      return;
    }
    if (row.isNew) {
      rows.value = rows.value.filter((r) => rowKey(r) !== rk);
      return;
    }
    const orig = originalRows.value[row.originalIndex];
    if (!orig) {
      return;
    }
    row.value = orig.value;
    row.value_type = orig.value_type;
    row.isDeleted = false;
  }

  function revertAll() {
    rows.value = originalRows.value.map((r, i) => ({
      ...r,
      originalIndex: i,
      isNew: false,
      isDeleted: false,
    }));
  }

  /**
   * 把当前编辑视图固化为新的基准（写回成功后无法/无需再 parseFile 时使用）：
   * - 已删除的行真正剔除
   * - 其余行清零 isNew / isDeleted，重设 originalIndex
   * - originalRows 同步更新，pendingEditCount 归零
   */
  function commitCurrentAsBaseline(newBinPath: string) {
    const survivors = rows.value.filter((r) => !r.isDeleted);
    originalRows.value = survivors.map((r) => ({
      namespace: r.namespace,
      key: r.key,
      value_type: r.value_type,
      value: r.value,
      is_binary: r.is_binary,
    }));
    rows.value = originalRows.value.map((r, i) => ({
      ...r,
      originalIndex: i,
      isNew: false,
      isDeleted: false,
    }));
    nvsBinPath.value = newBinPath;
    sourceIsDevice.value = true;
  }

  /** 在原 NVS 基础上应用编辑生成新 .bin，返回新文件路径与统计 */
  async function rebuildToFile(): Promise<NvsRebuildSummary> {
    if (!nvsBinPath.value) {
      throw new Error("NO_SOURCE");
    }
    const sizeBytes = parseSizeParam(size.value);
    if (!sizeBytes || sizeBytes % 0x1000 !== 0) {
      throw new Error("BAD_SIZE");
    }

    const edits = buildEdits();
    if (edits.length === 0) {
      throw new Error("NO_EDITS");
    }

    const dir = await getCurrentDir();
    const savePath = `${dir}\\nvs\\nvs-edited-${moment().valueOf()}.bin`;

    return rebuildNvsPartition({
      sourcePath: nvsBinPath.value,
      edits,
      size: sizeBytes,
      savePath,
    });
  }

  /** 重建 NVS 二进制并烧录回设备的 NVS 分区偏移 */
  async function writeBackToDevice(): Promise<{
    summary: NvsRebuildSummary;
    offset: string;
    /** 写回成功后刷新基准是否失败（非关键步骤；仅作日志/提示用） */
    refreshError?: unknown;
  }> {
    const port = localStorage.getItem("port");
    if (!port) {
      throw new Error("NO_PORT");
    }
    if (!sourceIsDevice.value) {
      throw new Error("NOT_FROM_DEVICE");
    }
    const summary = await rebuildToFile();
    await runEsptoolWriteFlash(
      port,
      baudRate.value,
      [{ offset: offset.value, path: summary.save_path }],
      { eraseAll: false }
    );

    // ⬇️ 走到这里 = esptool write_flash 已成功写入设备
    // (runEsptoolWriteFlash 内部基于 stdout 的 "Hash of data verified" /
    //  "Leaving..." 等成功标志做判定，吃掉了 Tauri Shell close/error 竞态)
    //
    // 下面的"刷新基准"只是为了让下次编辑有正确的 diff 起点，属于非关键步骤。
    // 即便 parse 失败（例如生成的 bin 自身解析时碰到 esp-nvs-partition-tool 的边角问题），
    // 也不应该让外层把整次写回判定为失败。
    let refreshError: unknown;
    try {
      await parseFile(summary.save_path, true);
    } catch (err) {
      refreshError = err;
      // 兜底：用当前 UI 状态作为新基准，避免后续 diff 错乱
      commitCurrentAsBaseline(summary.save_path);
      console.warn(
        "[NVS] 写回设备成功，但重新解析新 bin 失败，已使用本地状态作为基准：",
        err
      );
    }

    return { summary, offset: offset.value, refreshError };
  }

  /** 从用户选择的 ESP-IDF NVS CSV 一键生成 .bin（不直接烧录） */
  async function generateFromCsv(): Promise<NvsRebuildSummary | null> {
    const selected = await open({
      multiple: false,
      filters: [{ name: "ESP-IDF NVS CSV", extensions: ["csv"] }],
    });
    if (typeof selected !== "string") {
      return null;
    }
    const sizeBytes = parseSizeParam(size.value);
    if (!sizeBytes || sizeBytes % 0x1000 !== 0) {
      throw new Error("BAD_SIZE");
    }
    const dir = await getCurrentDir();
    const savePath = `${dir}\\nvs\\nvs-from-csv-${moment().valueOf()}.bin`;
    const summary = await generateNvsFromCsv({
      csvPath: selected,
      size: sizeBytes,
      savePath,
    });
    // 生成后立即用作当前编辑基准，但来源不是设备
    await parseFile(summary.save_path, false);
    return summary;
  }

  return {
    loading,
    rows,
    originalRows,
    keyword,
    offset,
    size,
    baudRate,
    detectedInfo,
    nvsBinPath,
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
  };
}
