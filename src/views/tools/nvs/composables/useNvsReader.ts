import { computed, ref } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { nowMs } from "@/utils/datetime";
import { runEsptoolReadFlash } from "@/utils/esptoolRead";
import { runEsptoolWriteFlash } from "@/utils/esptoolWrite";
import {
  findNvsPartition,
  formatHexDisplay,
  formatHexForEsptool,
} from "@/utils/partitionBin";
import { readPartitionTableFromDevice } from "@/utils/partitionDeviceRead";
import { resolvePartitionTableOffset } from "@/utils/partitionTable";
import {
  parseNvsPartition,
  rebuildNvsPartition,
  type NvsEdit,
  type NvsKeyValue,
  type NvsRebuildSummary,
} from "@/utils/nvs";
import { joinTempWorkDir } from "@/utils/tempWorkDir";
import { usePortStore } from "@/stores/port";
import { usePartitionTableStore } from "@/stores/partitionTable";
import { storeToRefs } from "pinia";

async function nvsTempPath(name: string): Promise<string> {
  return joinTempWorkDir("nvs", name);
}

export interface NvsEditableRow extends NvsKeyValue {
  /** 与 originalRows 中对应条目的下标（用于 diff） */
  originalIndex: number;
  /** 是否为新增行 */
  isNew: boolean;
  /** 是否被标记删除 */
  isDeleted: boolean;
}

/** 设备探测到的 NVS 分区定位信息（写回唯一依据） */
export interface NvsDeviceTarget {
  offset: number;
  size: number;
  name: string;
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
  /**
   * 仅当本次会话数据来自「从设备读取」且分区表探测成功时有值。
   * 写回必须走这里的 offset/size，禁止手填，避免写错分区。
   */
  const deviceTarget = ref<NvsDeviceTarget | null>(null);

  const keyword = ref("");
  const { tableOffset } = storeToRefs(usePartitionTableStore());
  const baudRate = ref("460800");
  const detectedInfo = ref("");

  const sourceIsDevice = computed(() => deviceTarget.value !== null && !!nvsBinPath.value);

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

  /** 清空会话数据；保留 tableOffset / baudRate 等工具栏输入 */
  function resetSession() {
    rows.value = [];
    originalRows.value = [];
    nvsBinPath.value = "";
    deviceTarget.value = null;
    detectedInfo.value = "";
  }

  /** 从设备读取分区表，返回 NVS 分区定位（不改会话，由调用方决定何时提交） */
  async function locateNvsOnDevice(port: string): Promise<NvsDeviceTarget> {
    const ptOffset = resolvePartitionTableOffset(tableOffset.value);
    // 随后还要再读 NVS：中间不要 hard-reset，否则 USB 串口会短暂消失导致第二次打开失败
    const partitions = await readPartitionTableFromDevice(
      port,
      baudRate.value,
      ptOffset,
      { after: "no-reset" }
    );
    const nvs = findNvsPartition(partitions);
    if (!nvs) {
      throw new Error("NO_NVS");
    }
    return { offset: nvs.offset, size: nvs.size, name: nvs.name };
  }

  function applyParsed(parsed: NvsKeyValue[], path: string, target: NvsDeviceTarget | null) {
    nvsBinPath.value = path;
    deviceTarget.value = target;
    originalRows.value = parsed.map((r) => ({ ...r }));
    rows.value = parsed.map((r, i) => ({
      ...r,
      originalIndex: i,
      isNew: false,
      isDeleted: false,
    }));
    if (target) {
      detectedInfo.value = `${target.name} @ ${formatHexDisplay(target.offset)}, ${formatHexDisplay(target.size)}`;
    } else {
      detectedInfo.value = "";
    }
  }

  async function parseFile(path: string, target: NvsDeviceTarget | null) {
    const parsed = await parseNvsPartition(path);
    applyParsed(parsed, path, target);
  }

  /** 探测 NVS 分区后读取并解析；偏移/大小完全来自分区表 */
  async function readFromDevice() {
    if (loading.value) {
      return;
    }
    const port = usePortStore().selectedPort;
    if (!port) {
      throw new Error("NO_PORT");
    }

    loading.value = true;
    resetSession();

    try {
      const target = await locateNvsOnDevice(port);
      const savePath = await nvsTempPath(`nvs-${nowMs()}.bin`);

      await runEsptoolReadFlash(
        port,
        baudRate.value,
        formatHexForEsptool(target.offset),
        formatHexForEsptool(target.size),
        savePath,
        // 分区表读取已用 no-reset 留在下载模式；最后一次再硬复位跑用户程序
        { before: "no-reset", after: "hard-reset" }
      );
      await parseFile(savePath, target);
    } catch (err) {
      // 半截失败时不允许残留可写回状态（例如已探测到分区但 flash 读失败）
      resetSession();
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function openLocalFile() {
    if (loading.value) {
      return;
    }
    const selected = await open({
      multiple: false,
      filters: [{ name: "NVS Binary", extensions: ["bin"] }],
    });
    if (typeof selected !== "string") {
      return;
    }

    loading.value = true;
    try {
      // 本地文件没有设备偏移，禁止写回
      await parseFile(selected, null);
    } catch (err) {
      resetSession();
      throw err;
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
   * 保留既有 deviceTarget，避免写回后丢失烧录偏移。
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
  }

  /** 在原 NVS 基础上应用编辑生成新 .bin；大小由源文件决定 */
  async function rebuildToFile(): Promise<NvsRebuildSummary> {
    if (!nvsBinPath.value) {
      throw new Error("NO_SOURCE");
    }

    const edits = buildEdits();
    if (edits.length === 0) {
      throw new Error("NO_EDITS");
    }

    const savePath = await nvsTempPath(`nvs-edited-${nowMs()}.bin`);

    return rebuildNvsPartition({
      sourcePath: nvsBinPath.value,
      edits,
      savePath,
    });
  }

  /** 重建 NVS 二进制并烧录回设备探测到的 NVS 偏移 */
  async function writeBackToDevice(): Promise<{
    summary: NvsRebuildSummary;
    offset: string;
    size: string;
    /** 写回成功后刷新基准是否失败（非关键步骤；仅作日志/提示用） */
    refreshError?: unknown;
  }> {
    if (loading.value) {
      throw new Error("BUSY");
    }
    const port = usePortStore().selectedPort;
    if (!port) {
      throw new Error("NO_PORT");
    }
    const target = deviceTarget.value;
    if (!target || !nvsBinPath.value) {
      throw new Error("NOT_FROM_DEVICE");
    }

    loading.value = true;
    try {
      const summary = await rebuildToFile();

      // 防御：重建产物长度必须与探测到的分区大小一致，否则禁止烧录
      if (summary.written_size !== target.size) {
        throw new Error("SIZE_MISMATCH");
      }

      const offsetHex = formatHexForEsptool(target.offset);
      await runEsptoolWriteFlash(
        port,
        baudRate.value,
        [{ offset: offsetHex, path: summary.save_path }],
        { eraseAll: false }
      );

      // 写回成功后刷新基准（非关键；失败不推翻写回结果）
      let refreshError: unknown;
      try {
        await parseFile(summary.save_path, target);
      } catch (err) {
        refreshError = err;
        commitCurrentAsBaseline(summary.save_path);
        console.warn(
          "[NVS] 写回设备成功，但重新解析新 bin 失败，已使用本地状态作为基准：",
          err
        );
      }

      return {
        summary,
        offset: offsetHex,
        size: formatHexForEsptool(target.size),
        refreshError,
      };
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    rows,
    originalRows,
    keyword,
    tableOffset,
    baudRate,
    detectedInfo,
    deviceTarget,
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
  };
}
