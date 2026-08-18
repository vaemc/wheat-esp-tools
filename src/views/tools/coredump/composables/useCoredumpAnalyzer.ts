import { computed, nextTick, ref, watch } from "vue";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { nowMs } from "@/utils/datetime";
import { runEsptoolReadFlash } from "@/utils/esptoolRead";
import { runEsptoolEraseRegion } from "@/utils/esptoolErase";
import {
  findCoredumpPartition,
  formatHexDisplay,
  formatHexForEsptool,
  type FlashPartition,
} from "@/utils/partitionBin";
import { readPartitionTableFromDevice } from "@/utils/partitionDeviceRead";
import { resolvePartitionTableOffset } from "@/utils/partitionTable";
import { joinTempWorkDir } from "@/utils/tempWorkDir";
import { usePortStore } from "@/stores/port";
import { usePartitionTableStore } from "@/stores/partitionTable";
import { useElfHistoryStore } from "@/stores/elfHistory";
import { storeToRefs } from "pinia";
import {
  diagnose,
  formatAddr2lineCmd,
  formatIdfPanicLog,
  formatPc,
  lookupAddr2line,
  lookupSymbol,
  parseCoredumpImage,
  parseFirmwareElf,
  processStackPc,
  type Addr2LineFrame,
  type CoredumpReport,
  type Diagnosis,
  type ElfParsePhase,
  type SymbolHit,
} from "@/utils/coredump";

export function useCoredumpAnalyzer() {
  const loading = ref(false);
  const elfLoading = ref(false);
  const elfPhase = ref<ElfParsePhase | "idle" | "reading">("idle");
  const elfProgress = ref(0);
  const { tableOffset } = storeToRefs(usePartitionTableStore());
  const elfHistory = useElfHistoryStore();
  const baudRate = ref("460800");
  const detectedInfo = ref("");
  const dumpPath = ref("");
  const elfPath = ref("");
  const report = ref<CoredumpReport | null>(null);
  const symbols = ref<SymbolHit[]>([]);
  const elfSha256 = ref("");
  const parseError = ref("");
  const lineHits = ref<Record<number, Addr2LineFrame[]>>({});
  const lineLoading = ref(false);
  let lineSeq = 0;

  const diagnosis = computed<Diagnosis | null>(() => {
    const r = report.value;
    if (!r || r.empty) {
      return null;
    }
    return diagnose({
      panicDetails: r.panicDetails,
      exccause: r.exccause,
      excvaddr: r.excvaddr,
      pc: r.registers?.pc ?? 0,
      backtraceCorrupted: r.backtraceCorrupted,
      crashedTask: r.crashedTask,
      isrContext: r.isrContext,
    });
  });

  const shaMismatch = computed(() => {
    const dumpSha = (report.value?.appElfSha256 || "").replace(/[^0-9a-f]/gi, "").toLowerCase();
    const fileSha = elfSha256.value.replace(/[^0-9a-f]/gi, "").toLowerCase();
    if (!dumpSha || !fileSha) {
      return false;
    }
    return !fileSha.startsWith(dumpSha.slice(0, 16)) && !dumpSha.startsWith(fileSha.slice(0, 16));
  });

  const symbolicated = computed(() => {
    const r = report.value;
    if (!r) {
      return [];
    }
    return r.backtrace.map((frame) => ({
      ...frame,
      symbol: lookupSymbol(symbols.value, frame.pc),
      source: lineHits.value[frame.pc >>> 0] ?? [],
    }));
  });

  const crashedPcSymbol = computed(() => {
    const pc = report.value?.registers?.pc;
    if (pc == null) {
      return undefined;
    }
    return lookupSymbol(symbols.value, pc);
  });

  const panicLogText = computed(() => {
    const r = report.value;
    if (!r || r.empty) {
      return "";
    }
    return formatIdfPanicLog(r);
  });

  const addr2lineCmd = computed(() => {
    const pcs = symbolicated.value.map((f) => f.pc);
    if (!pcs.length) {
      return "";
    }
    return formatAddr2lineCmd(elfPath.value, pcs);
  });

  const shaMatched = computed(() => {
    const dumpSha = (report.value?.appElfSha256 || "").replace(/[^0-9a-f]/gi, "").toLowerCase();
    const fileSha = elfSha256.value.replace(/[^0-9a-f]/gi, "").toLowerCase();
    if (!dumpSha || !fileSha) {
      return false;
    }
    return !shaMismatch.value;
  });

  const hasLineInfo = computed(() =>
    Object.values(lineHits.value).some((frames) =>
      frames.some((f) => !!f.file && f.line != null)
    )
  );

  const crashedPcSource = computed(
    () => lineHits.value[(report.value?.registers?.pc ?? 0) >>> 0] ?? []
  );

  const lookupKey = computed(() => {
    const r = report.value;
    if (!elfPath.value || !r || r.empty) {
      return "";
    }
    const pcs: number[] = [];
    for (const f of r.backtrace) {
      pcs.push(f.pc >>> 0);
    }
    if (r.registers) {
      pcs.push(r.registers.pc >>> 0);
      pcs.push(processStackPc(r.registers.a?.[0] ?? 0));
    }
    for (const t of r.tasks) {
      pcs.push(t.pc >>> 0);
    }
    return `${elfPath.value}\n${pcs.join(",")}`;
  });

  watch(lookupKey, async (key) => {
    if (!key) {
      lineHits.value = {};
      lineLoading.value = false;
      return;
    }
    const nl = key.indexOf("\n");
    const path = key.slice(0, nl);
    const addresses = key
      .slice(nl + 1)
      .split(",")
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0);
    const seq = ++lineSeq;
    lineLoading.value = true;
    try {
      const hits = await lookupAddr2line(path, addresses);
      if (seq !== lineSeq) {
        return;
      }
      const next: Record<number, Addr2LineFrame[]> = {};
      for (const hit of hits) {
        if (hit.frames?.length) {
          next[hit.address >>> 0] = hit.frames;
        }
      }
      lineHits.value = next;
    } catch (e) {
      if (seq !== lineSeq) {
        return;
      }
      console.warn("[coredump] addr2line failed:", e);
      lineHits.value = {};
    } finally {
      if (seq === lineSeq) {
        lineLoading.value = false;
      }
    }
  });

  function applyDump(bytes: Uint8Array, path: string): void {
    parseError.value = "";
    const parsed = parseCoredumpImage(bytes);
    report.value = parsed;
    dumpPath.value = path;
    if (!parsed.empty && symbols.value.length) {
      parsed.backtrace = parsed.backtrace.map((f) => ({
        ...f,
        symbol: lookupSymbol(symbols.value, f.pc),
      }));
    }
  }

  async function locateCoredumpPartition(): Promise<{
    port: string;
    part: FlashPartition;
  }> {
    const port = usePortStore().selectedPort;
    if (!port) {
      throw new Error("NO_PORT");
    }
    const ptOffset = resolvePartitionTableOffset(tableOffset.value);
    const partitions = await readPartitionTableFromDevice(port, baudRate.value, ptOffset, {
      after: "no-reset",
    });
    const part = findCoredumpPartition(partitions);
    if (!part) {
      detectedInfo.value = "";
      throw new Error("NO_COREDUMP");
    }
    detectedInfo.value = `${part.name} @ ${formatHexDisplay(part.offset)}, ${formatHexDisplay(part.size)}`;
    return { port, part };
  }

  async function readFromDevice(): Promise<void> {
    loading.value = true;
    try {
      const { port, part } = await locateCoredumpPartition();
      const savePath = await joinTempWorkDir("coredump", `dump-${nowMs()}.bin`);
      await runEsptoolReadFlash(
        port,
        baudRate.value,
        formatHexForEsptool(part.offset),
        formatHexForEsptool(part.size),
        savePath,
        { after: "hard-reset" }
      );
      const bytes = await readFile(savePath);
      applyDump(new Uint8Array(bytes), savePath);
    } finally {
      loading.value = false;
    }
  }

  async function eraseCoredumpPartition(): Promise<void> {
    loading.value = true;
    try {
      const { port, part } = await locateCoredumpPartition();
      await runEsptoolEraseRegion(
        port,
        baudRate.value,
        formatHexForEsptool(part.offset),
        formatHexForEsptool(part.size),
        { after: "hard-reset" }
      );
      dumpPath.value = "";
      report.value = {
        header: { dataLen: 0, version: 0, chipRev: 0 },
        empty: true,
        panicDetails: "",
        appElfSha256: "",
        coreDumpVersion: 0,
        crashedTcb: 0,
        crashedTask: "",
        isrContext: false,
        exccause: 0,
        excvaddr: 0,
        registers: null,
        backtrace: [],
        backtraceCorrupted: false,
        tasks: [],
        loadSegments: [],
      };
    } finally {
      loading.value = false;
    }
  }

  async function openDumpFile(): Promise<boolean> {
    const selected = await open({
      multiple: false,
      filters: [
        { name: "Core dump", extensions: ["bin", "elf", "core"] },
        { name: "All", extensions: ["*"] },
      ],
    });
    if (!selected || Array.isArray(selected)) {
      return false;
    }
    loading.value = true;
    try {
      const bytes = await readFile(selected);
      detectedInfo.value = selected;
      applyDump(new Uint8Array(bytes), selected);
      return true;
    } finally {
      loading.value = false;
    }
  }

  async function loadFirmwareElf(path?: string): Promise<boolean> {
    let selected = path;
    if (!selected) {
      const picked = await open({
        multiple: false,
        filters: [
          { name: "ELF", extensions: ["elf"] },
          { name: "All", extensions: ["*"] },
        ],
      });
      if (!picked || Array.isArray(picked)) {
        return false;
      }
      selected = picked;
    }
    elfLoading.value = true;
    elfPhase.value = "reading";
    elfProgress.value = 8;
    try {
      await nextTick();
      const bytes = await readFile(selected);
      const buf = new Uint8Array(bytes);
      elfPhase.value = "symbols";
      elfProgress.value = 16;
      await nextTick();
      const parsed = await parseFirmwareElf(buf, (p) => {
        elfPhase.value = p.phase;
        elfProgress.value =
          p.phase === "symbols"
            ? 16 + Math.round(p.percent * 0.64)
            : 80 + Math.round(p.percent * 0.2);
      });
      symbols.value = parsed.symbols;
      elfSha256.value = parsed.sha256;
      elfPath.value = selected;
      elfHistory.addPath(selected);
      elfProgress.value = 100;
      return true;
    } catch (e) {
      if (e instanceof Error && (e.message === "NOT_ELF" || e.message === "ELF_NOT_32")) {
        throw e;
      }
      if (path) {
        elfHistory.removePath(path);
        if (elfPath.value === path) {
          clearElf();
        }
        throw new Error("ELF_MISSING");
      }
      throw e;
    } finally {
      elfLoading.value = false;
      elfPhase.value = "idle";
      elfProgress.value = 0;
    }
  }

  function clearElf(): void {
    symbols.value = [];
    elfSha256.value = "";
    elfPath.value = "";
    lineHits.value = {};
  }

  async function exportReport(text: string): Promise<string | null> {
    const dest = await save({
      defaultPath: `crash-report-${nowMs()}.txt`,
      filters: [{ name: "Text", extensions: ["txt"] }],
    });
    if (!dest) {
      return null;
    }
    await writeFile(dest, new TextEncoder().encode(text));
    return dest;
  }

  return {
    loading,
    elfLoading,
    elfPhase,
    elfProgress,
    baudRate,
    tableOffset,
    detectedInfo,
    dumpPath,
    elfPath,
    report,
    symbols,
    diagnosis,
    shaMismatch,
    shaMatched,
    symbolicated,
    crashedPcSymbol,
    crashedPcSource,
    hasLineInfo,
    lineLoading,
    lineHits,
    panicLogText,
    addr2lineCmd,
    parseError,
    formatPc,
    readFromDevice,
    eraseCoredumpPartition,
    openDumpFile,
    loadFirmwareElf,
    clearElf,
    exportReport,
  };
}
