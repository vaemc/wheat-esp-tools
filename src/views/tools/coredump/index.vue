<template>
  <div class="crash-page">
    <section class="toolbar panel">
      <div class="toolbar-row">
        <div class="tool-group">
          <span class="tool-kicker">{{ $t("crash.dumpGroup") }}</span>
          <div class="tool-row">
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
              <span class="field-label">{{ $t("nvs.baudRate") }}</span>
              <a-select
                v-model:value="baudRate"
                class="baud-select"
                :options="baudOptions"
                :disabled="loading"
              />
            </label>
            <div class="tool-actions">
              <a-button type="primary" :loading="loading" :disabled="elfLoading" @click="onReadDevice">
                {{ $t("crash.readFromDevice") }}
              </a-button>
              <a-button :loading="loading" :disabled="elfLoading" @click="onOpenDump">
                {{ $t("crash.openDump") }}
              </a-button>
              <a-button
                type="primary"
                danger
                :loading="loading"
                :disabled="elfLoading"
                @click="onEraseDump"
              >
                {{ $t("crash.eraseDump") }}
              </a-button>
            </div>
          </div>
        </div>

        <div class="tool-group tool-group-elf">
          <span class="tool-kicker">{{ $t("crash.elfGroup") }}</span>
          <div class="tool-row">
            <a-button :loading="elfLoading" :disabled="loading" @click="onLoadElf">
              {{ $t("crash.loadElf") }}
            </a-button>
            <a-select
              class="elf-history-select"
              :value="elfPath || undefined"
              :placeholder="$t('crash.elfHistoryPlaceholder')"
              :options="elfHistoryOptions"
              :disabled="loading || elfLoading || !elfHistoryItems.length"
              show-search
              :filter-option="filterElfHistory"
              :popup-match-select-width="false"
              @change="onPickHistoryElf"
            >
              <template #option="{ label, value }">
                <div class="elf-opt">
                  <span class="elf-opt-name">{{ label }}</span>
                  <span class="elf-opt-path">{{ value }}</span>
                </div>
              </template>
            </a-select>
            <span v-if="report && !report.empty" class="tag" :class="'tag-' + shaTone" :title="shaTitle">
              {{ shaLabel }}
            </span>
            <a-button v-if="elfPath" type="link" size="small" @click="clearElf">
              {{ $t("crash.clearElf") }}
            </a-button>
          </div>
        </div>

        <a-button
          class="export-btn"
          :disabled="!report || report.empty || loading || elfLoading"
          @click="onExport"
        >
          {{ $t("crash.exportReport") }}
        </a-button>
      </div>
      <p v-if="detectedInfo" class="detected-info">{{ detectedInfo }}</p>
      <p v-if="!report" class="toolbar-hint">{{ $t("crash.detectHint") }}</p>
      <div v-if="elfLoading" class="elf-progress">
        <div class="elf-progress-meta">
          <span>{{ elfProgressMsg }}</span>
          <span>{{ elfProgress }}%</span>
        </div>
        <a-progress
          :percent="elfProgress"
          :show-info="false"
          size="small"
          status="active"
        />
      </div>
    </section>

    <section v-if="!report" class="panel panel-empty">
      <PlaceholderHint :text="$t('crash.emptyHint')" />
    </section>

    <section v-else-if="report.empty" class="panel panel-empty">
      <PlaceholderHint :text="$t('crash.emptyPartition')" />
    </section>

    <template v-else>
      <section class="banner" :class="'banner-' + bannerTone">
        <div class="banner-tags">
          <span class="tag" :class="bannerTone === 'warn' ? 'tag-warn' : 'tag-crit'">
            {{ bannerTone === "warn" ? $t("crash.severityWarning") : $t("crash.severityCritical") }}
          </span>
          <span
            v-if="diagnosis"
            class="tag"
            :class="'tag-' + excTone(report.exccause)"
            :title="$t(diagnosis.exceptionExplainKey)"
          >{{ diagnosis.exceptionName }}</span>
          <span class="tag tag-muted">EXCCAUSE {{ report.exccause }}</span>
          <span class="tag" :class="report.isrContext ? 'tag-warn' : 'tag-muted'">
            {{ report.isrContext ? $t("crash.isrContext") : $t("crash.taskContext") }}
          </span>
          <span
            class="tag"
            :class="'tag-' + excRegion.tone"
            :title="$t(excRegion.labelKey)"
          >EXCVADDR {{ $t("crash.memTag." + excRegion.id) }}</span>
          <span class="tag" :class="'tag-' + shaTone" :title="shaTitle">{{ shaLabel }}</span>
          <span v-if="report.backtraceCorrupted" class="tag tag-warn">{{ $t("crash.btCorrupted") }}</span>
        </div>
        <h1 class="banner-title">{{ diagnosis ? $t(diagnosis.causeKey) : $t("crash.cause.generic") }}</h1>
        <p class="banner-culprit">
          <span class="culprit-fn">{{ culpritFn }}</span>
          <code
            v-if="crashedPcSource[0]"
            v-copy="formatSourceCopy(crashedPcSource[0])"
            class="src-chip"
            :title="crashedPcSource[0].file"
          >{{ formatSourceLoc(crashedPcSource[0]) }}</code>
          <span class="dot">·</span>
          <span class="mono">{{ report.crashedTask || "—" }}</span>
        </p>
        <p v-if="diagnosis" class="banner-exc">{{ $t(diagnosis.exceptionExplainKey) }}</p>
      </section>

      <div class="grid">
        <section class="panel backtrace">
          <header class="panel-head">
            <span class="panel-title">{{ $t("crash.backtrace") }}</span>
            <div class="panel-actions">
              <span v-if="lineLoading" class="tag tag-warn">{{ $t("crash.resolvingLines") }}</span>
              <a-tooltip v-if="panicLogText" :title="$t('crash.copyPanicLogHint')">
                <a-button size="small" v-copy="panicLogText">
                  {{ $t("crash.copyPanicLog") }}
                </a-button>
              </a-tooltip>
              <a-button v-if="addr2lineCmd" size="small" v-copy="addr2lineCmd">
                {{ $t("crash.copyAddr2line") }}
              </a-button>
            </div>
          </header>
          <ol v-if="symbolicated.length" class="bt-list">
            <li
              v-for="(frame, idx) in symbolicated"
              :key="idx"
              :class="{ top: idx === 0 }"
            >
              <span class="bt-idx">#{{ idx }}</span>
              <div class="bt-body">
                <div class="bt-sym">
                  {{ frame.symbol ? formatSymbol(frame.symbol) : $t("crash.unknownSymbol") }}
                </div>
                <div class="bt-meta">
                  <code v-copy="formatPc(frame.pc)" class="pc-chip">{{ formatPc(frame.pc) }}</code>
                  <span
                    class="tag"
                    :class="'tag-' + memTagTone(frame.pc)"
                    :title="memTagTitle(frame.pc)"
                  >{{ $t("crash.memTag." + memTagKey(frame.pc)) }}</span>
                  <span class="sp mono">SP {{ formatPc(frame.sp) }}</span>
                </div>
                <div v-if="frame.source?.[0]" class="bt-src">
                  <code
                    v-copy="formatSourceCopy(frame.source[0])"
                    class="src-chip"
                    :title="frame.source[0].file"
                  >{{ formatSourceLoc(frame.source[0]) }}</code>
                  <span v-if="frame.source[0].function" class="src-fn">{{ frame.source[0].function }}</span>
                </div>
                <div
                  v-for="(inline, i) in (frame.source ?? []).slice(1)"
                  :key="i"
                  class="bt-inline"
                >
                  {{ $t("crash.inlined") }}
                  {{ inline.function }}
                  <code
                    v-if="formatSourceLoc(inline)"
                    v-copy="formatSourceCopy(inline)"
                    class="src-chip"
                    :title="inline.file"
                  >{{ formatSourceLoc(inline) }}</code>
                </div>
              </div>
            </li>
          </ol>
          <PlaceholderHint v-else :text="$t('crash.noBacktrace')" />
          <p
            v-if="symbolicated.length && elfPath && !lineLoading && !hasLineInfo"
            class="elf-hint"
          >{{ $t("crash.noDebugInfo") }}</p>
        </section>

        <aside class="side">
          <section class="panel identity">
            <header class="panel-head">
              <span class="panel-title">{{ $t("crash.identity") }}</span>
            </header>
            <dl class="kv">
              <div>
                <dt>{{ $t("crash.task") }}</dt>
                <dd class="mono">{{ report.crashedTask || "—" }}</dd>
              </div>
              <div>
                <dt>PC</dt>
                <dd class="kv-flow">
                  <code v-copy="formatPc(report.registers?.pc ?? 0)" class="pc-chip">
                    {{ formatPc(report.registers?.pc ?? 0) }}
                  </code>
                  <span
                    class="tag"
                    :class="'tag-' + pcRegion.tone"
                    :title="$t(pcRegion.labelKey)"
                  >{{ $t("crash.memTag." + pcRegion.id) }}</span>
                  <span v-if="crashedPcSymbol" class="sym">{{ formatSymbol(crashedPcSymbol) }}</span>
                  <code
                    v-if="crashedPcSource[0]"
                    v-copy="formatSourceCopy(crashedPcSource[0])"
                    class="src-chip"
                    :title="crashedPcSource[0].file"
                  >{{ formatSourceLoc(crashedPcSource[0]) }}</code>
                </dd>
              </div>
              <div>
                <dt>{{ $t("crash.a0hint") }}</dt>
                <dd class="kv-flow">
                  <code v-copy="formatPc(returnAddr)" class="pc-chip">{{ formatPc(returnAddr) }}</code>
                  <span v-if="returnSymbol" class="sym">{{ formatSymbol(returnSymbol) }}</span>
                  <code
                    v-if="returnSource[0]"
                    v-copy="formatSourceCopy(returnSource[0])"
                    class="src-chip"
                    :title="returnSource[0].file"
                  >{{ formatSourceLoc(returnSource[0]) }}</code>
                </dd>
              </div>
              <div>
                <dt>EXCVADDR</dt>
                <dd class="kv-flow">
                  <code
                    v-copy="formatPc(report.excvaddr)"
                    class="pc-chip"
                    :class="{ 'pc-null': report.excvaddr < 0x10000 }"
                  >{{ formatPc(report.excvaddr) }}</code>
                  <span
                    class="tag"
                    :class="'tag-' + excRegion.tone"
                    :title="$t(excRegion.labelKey)"
                  >{{ $t("crash.memTag." + excRegion.id) }}</span>
                </dd>
              </div>
              <div>
                <dt>{{ $t("crash.panicDetails") }}</dt>
                <dd class="wrap">{{ report.panicDetails || "—" }}</dd>
              </div>
              <div>
                <dt>ELF SHA256</dt>
                <dd class="mono sha">{{ report.appElfSha256 || "—" }}</dd>
              </div>
              <div v-if="elfPath">
                <dt>{{ $t("crash.elfFile") }}</dt>
                <dd class="wrap" :title="elfPath">{{ elfName }}</dd>
              </div>
            </dl>
            <p v-if="shaMismatch" class="sha-warn">{{ $t("crash.shaMismatch") }}</p>
            <p v-else-if="!elfPath" class="elf-hint">{{ $t("crash.elfHint") }}</p>
          </section>

          <section class="panel hints">
            <header class="panel-head">
              <span class="panel-title">{{ $t("crash.nextSteps") }}</span>
            </header>
            <ul v-if="diagnosis" class="hint-list">
              <li v-for="key in diagnosis.hintKeys" :key="key">{{ $t(key) }}</li>
            </ul>
          </section>
        </aside>
      </div>

      <section class="panel regs">
        <header class="panel-head">
          <span class="panel-title">{{ $t("crash.registers") }}</span>
        </header>
        <div v-if="report.registers" class="reg-grid">
          <div class="reg reg-hot">
            <span class="reg-name">PC</span>
            <code v-copy="formatPc(report.registers.pc)">{{ formatPc(report.registers.pc) }}</code>
          </div>
          <div class="reg">
            <span class="reg-name">PS</span>
            <code v-copy="formatPc(report.registers.ps)">{{ formatPc(report.registers.ps) }}</code>
          </div>
          <div
            v-for="(val, i) in report.registers.a"
            :key="'a' + i"
            class="reg"
            :class="{ 'reg-hot': i === 0 || i === 1, 'reg-hit': val === report.excvaddr && report.excvaddr !== 0 }"
          >
            <span class="reg-name">{{ regAlias(i) }}</span>
            <code v-copy="formatPc(val)">{{ formatPc(val) }}</code>
          </div>
        </div>
        <PlaceholderHint v-else :text="$t('crash.noRegs')" />
      </section>

      <section class="panel tasks">
        <header class="panel-head">
          <span class="panel-title">{{ $t("crash.tasks") }}</span>
          <span class="panel-meta">{{ taskRows.length }}</span>
        </header>
        <a-table
          size="small"
          :bordered="true"
          :pagination="false"
          :data-source="taskRows"
          :columns="taskColumns"
          row-key="tcbAddr"
          :row-class-name="taskRowClass"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <span class="mono">{{ record.name || "—" }}</span>
              <span v-if="record.crashed" class="tag-crash">CRASH</span>
            </template>
            <template v-else-if="column.key === 'pc'">
              <code v-copy="formatPc(record.pc)">{{ formatPc(record.pc) }}</code>
              <span v-if="record.symbol" class="sym">{{ formatSymbol(record.symbol) }}</span>
              <code
                v-if="record.source?.[0]"
                v-copy="formatSourceCopy(record.source[0])"
                class="src-chip"
                :title="record.source[0].file"
              >{{ formatSourceLoc(record.source[0]) }}</code>
            </template>
            <template v-else-if="column.key === 'sp'">
              <code v-copy="formatPc(record.sp)">{{ formatPc(record.sp) }}</code>
            </template>
            <template v-else-if="column.key === 'tcb'">
              <code v-copy="formatPc(record.tcbAddr)">{{ formatPc(record.tcbAddr) }}</code>
            </template>
          </template>
        </a-table>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, h } from "vue";
import { useI18n } from "vue-i18n";
import { message, Modal } from "ant-design-vue";
import { storeToRefs } from "pinia";
import PlaceholderHint from "@/components/PlaceholderHint.vue";
import { READ_BAUD_RATE_OPTIONS, toBaudSelectOptions } from "@/composables/useFlashOptions";
import { reportEspflashError } from "@/utils/espflash";
import {
  classifyEspAddr,
  formatPc,
  formatSourceCopy,
  formatSourceLoc,
  formatSymbol,
  lookupSymbol,
  processStackPc,
} from "@/utils/coredump";
import { useElfHistoryStore } from "@/stores/elfHistory";
import { usePortStore } from "@/stores/port";
import { basename } from "@/utils/path";
import { useCoredumpAnalyzer } from "./composables/useCoredumpAnalyzer";

const { t } = useI18n();
const baudOptions = toBaudSelectOptions(READ_BAUD_RATE_OPTIONS);

const {
  loading,
  elfLoading,
  elfPhase,
  elfProgress,
  baudRate,
  tableOffset,
  detectedInfo,
  elfPath,
  report,
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
  symbols,
  readFromDevice,
  eraseCoredumpPartition,
  openDumpFile,
  loadFirmwareElf,
  clearElf,
  exportReport,
} = useCoredumpAnalyzer();

const elfHistoryStore = useElfHistoryStore();
const { items: elfHistoryItems } = storeToRefs(elfHistoryStore);

const elfHistoryOptions = computed(() =>
  elfHistoryItems.value.map((item) => ({
    value: item.path,
    label: item.name,
    title: item.path,
  }))
);

const elfProgressMsg = computed(() => {
  switch (elfPhase.value) {
    case "reading":
      return t("crash.elfReading");
    case "symbols":
      return t("crash.elfParsing");
    case "sha":
      return t("crash.elfExtracting");
    default:
      return t("crash.elfParsing");
  }
});

const pcRegion = computed(() => classifyEspAddr(report.value?.registers?.pc ?? 0));
const excRegion = computed(() => classifyEspAddr(report.value?.excvaddr ?? 0));

const returnAddr = computed(() => processStackPc(report.value?.registers?.a?.[0] ?? 0));
const returnSymbol = computed(() => lookupSymbol(symbols.value, returnAddr.value));
const returnSource = computed(() => lineHits.value[returnAddr.value >>> 0] ?? []);

const elfName = computed(() => (elfPath.value ? basename(elfPath.value) : ""));

const shaStatus = computed<"none" | "match" | "mismatch" | "pending">(() => {
  if (!elfPath.value) {
    return "none";
  }
  if (shaMismatch.value) {
    return "mismatch";
  }
  if (shaMatched.value) {
    return "match";
  }
  return "pending";
});

const shaTone = computed(() => {
  switch (shaStatus.value) {
    case "match":
      return "ok";
    case "mismatch":
      return "warn";
    case "pending":
      return "code";
    default:
      return "muted";
  }
});

const shaLabel = computed(() => {
  switch (shaStatus.value) {
    case "match":
      return t("crash.shaMatchTag");
    case "mismatch":
      return t("crash.shaMismatchTag");
    case "pending":
      return t("crash.shaPending");
    default:
      return t("crash.shaNoneTag");
  }
});

const shaTitle = computed(() => {
  switch (shaStatus.value) {
    case "match":
      return t("crash.shaMatch");
    case "mismatch":
      return t("crash.shaMismatch");
    case "pending":
      return elfPath.value;
    default:
      return t("crash.elfHint");
  }
});

const bannerTone = computed<"crit" | "warn">(() => {
  const key = diagnosis.value?.causeKey ?? "";
  if (key.includes("wdt") || key.includes("stack")) {
    return "warn";
  }
  return "crit";
});

const culpritFn = computed(() => {
  const src = crashedPcSource.value[0];
  if (src?.function) {
    return src.function;
  }
  if (crashedPcSymbol.value) {
    return formatSymbol(crashedPcSymbol.value);
  }
  return formatPc(report.value?.registers?.pc ?? 0);
});

const culpritLabel = computed(() => {
  const loc = crashedPcSource.value[0] ? formatSourceLoc(crashedPcSource.value[0]) : "";
  if (loc) {
    return `${culpritFn.value}  ${loc}`;
  }
  return culpritFn.value;
});

const taskRows = computed(() =>
  (report.value?.tasks ?? []).map((task) => ({
    ...task,
    symbol: lookupSymbol(symbols.value, task.pc),
    source: lineHits.value[task.pc >>> 0] ?? [],
  }))
);

const taskColumns = computed(() => [
  { title: t("crash.task"), key: "name", dataIndex: "name" },
  { title: "PC", key: "pc", dataIndex: "pc" },
  { title: "SP", key: "sp", dataIndex: "sp", width: 140 },
  { title: "TCB", key: "tcb", dataIndex: "tcbAddr", width: 140 },
]);

function excTone(code: number): string {
  if (code === 28 || code === 29 || code === 3 || code === 9) {
    return "crit";
  }
  if (code === 0 || code === 20 || code === 18) {
    return "ctrl";
  }
  if (code === 6 || (code >= 32 && code <= 39)) {
    return "warn";
  }
  return "muted";
}

function memTagKey(addr: number): string {
  return classifyEspAddr(addr).id;
}

function memTagTone(addr: number): string {
  return classifyEspAddr(addr).tone;
}

function memTagTitle(addr: number): string {
  return t(classifyEspAddr(addr).labelKey);
}

function filterElfHistory(input: string, option: { label?: string; value?: string }): boolean {
  const q = input.trim().toLowerCase();
  if (!q) {
    return true;
  }
  return (
    String(option.label ?? "").toLowerCase().includes(q) ||
    String(option.value ?? "").toLowerCase().includes(q)
  );
}

function regAlias(i: number): string {
  if (i === 0) {
    return "A0 RA";
  }
  if (i === 1) {
    return "A1 SP";
  }
  return `A${i}`;
}

function taskRowClass(record: { crashed: boolean }): string {
  return record.crashed ? "task-crash-row" : "";
}

function buildExportText(): string {
  const r = report.value;
  if (!r || r.empty) {
    return "";
  }
  const lines: string[] = [
    "Wheat ESP Tools — Crash Report",
    `Cause: ${diagnosis.value ? t(diagnosis.value.causeKey) : ""}`,
    `Exception: ${diagnosis.value?.exceptionName ?? ""} (${r.exccause})`,
    `Task: ${r.crashedTask}${r.isrContext ? " [ISR]" : ""}`,
    `PC: ${formatPc(r.registers?.pc ?? 0)}${crashedPcSymbol.value ? " " + formatSymbol(crashedPcSymbol.value) : ""}${crashedPcSource.value[0] ? " " + formatSourceCopy(crashedPcSource.value[0]) : ""}`,
    `A0: ${formatPc(returnAddr.value)}${returnSymbol.value ? " " + formatSymbol(returnSymbol.value) : ""}${returnSource.value[0] ? " " + formatSourceCopy(returnSource.value[0]) : ""}`,
    `EXCVADDR: ${formatPc(r.excvaddr)} (${t(excRegion.value.labelKey)})`,
    `Panic: ${r.panicDetails || "-"}`,
    `ELF SHA256: ${r.appElfSha256 || "-"}`,
    "",
  ];
  if (panicLogText.value) {
    lines.push(panicLogText.value, "");
  }
  if (addr2lineCmd.value) {
    lines.push(addr2lineCmd.value, "");
  }
  lines.push("Frames:");
  for (const [i, frame] of symbolicated.value.entries()) {
    const sym = frame.symbol ? formatSymbol(frame.symbol) : "?";
    const src = frame.source?.[0] ? `  ${formatSourceCopy(frame.source[0])}` : "";
    lines.push(`  #${i} ${formatPc(frame.pc)}  ${sym}${src}`);
    for (const inline of (frame.source ?? []).slice(1)) {
      lines.push(`       inlined ${inline.function}  ${formatSourceCopy(inline)}`);
    }
  }
  if (r.registers) {
    lines.push("", "Registers:");
    lines.push(`  PC ${formatPc(r.registers.pc)}  PS ${formatPc(r.registers.ps)}`);
    r.registers.a.forEach((val, i) => {
      lines.push(`  A${i} ${formatPc(val)}`);
    });
  }
  if (r.tasks.length) {
    lines.push("", "Tasks:");
    for (const task of r.tasks) {
      const mark = task.crashed ? " *" : "";
      lines.push(`  ${task.name || "-"}${mark}  PC ${formatPc(task.pc)}  TCB ${formatPc(task.tcbAddr)}`);
    }
  }
  if (diagnosis.value) {
    lines.push("", "Hints:");
    for (const key of diagnosis.value.hintKeys) {
      lines.push(`  - ${t(key)}`);
    }
  }
  return lines.join("\n");
}

async function onReadDevice() {
  try {
    await readFromDevice();
    if (report.value?.empty) {
      message.info(t("crash.emptyPartition"));
      return;
    }
    message.success(t("crash.readSuccess"));
  } catch (e) {
    if (e instanceof Error && e.message === "NO_PORT") {
      message.warning(t("nvs.noPort"));
      return;
    }
    if (e instanceof Error && e.message === "NO_COREDUMP") {
      message.error(t("crash.noPartition"));
      return;
    }
    if (e instanceof Error && e.message === "NOT_COREDUMP") {
      message.error(t("crash.parseFailed"));
      return;
    }
    console.error("[coredump] read failed:", e);
    reportEspflashError(e, "crash.readFailed");
  }
}

async function onEraseDump() {
  if (!usePortStore().selectedPort) {
    message.warning(t("nvs.noPort"));
    return;
  }
  Modal.confirm({
    title: t("crash.eraseConfirmTitle"),
    content: () =>
      h("div", null, [
        h("p", { style: "margin:0 0 6px;" }, t("crash.eraseConfirmBody")),
        detectedInfo.value
          ? h("p", { class: "mono", style: "margin:0 0 6px;" }, detectedInfo.value)
          : null,
        h(
          "p",
          { style: "margin:8px 0 0; color:#fa8c16; font-size:12px;" },
          t("crash.eraseConfirmWarn")
        ),
      ]),
    okText: t("crash.eraseConfirmOk"),
    okType: "danger",
    cancelText: t("nvs.confirmWriteCancel"),
    async onOk() {
      try {
        await eraseCoredumpPartition();
        message.success(t("crash.eraseSuccess"));
      } catch (e) {
        if (e instanceof Error && e.message === "NO_PORT") {
          message.warning(t("nvs.noPort"));
          throw e;
        }
        if (e instanceof Error && e.message === "NO_COREDUMP") {
          message.error(t("crash.noPartition"));
          throw e;
        }
        console.error("[coredump] erase failed:", e);
        reportEspflashError(e, "crash.eraseFailed");
        throw e;
      }
    },
  });
}

async function onOpenDump() {
  try {
    const ok = await openDumpFile();
    if (ok) {
      message.success(t("crash.readSuccess"));
    }
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_COREDUMP") {
      message.error(t("crash.parseFailed"));
      return;
    }
    message.error(t("crash.parseFailed"));
  }
}

async function onLoadElf() {
  try {
    const ok = await loadFirmwareElf();
    if (ok) {
      message.success(t("crash.elfLoaded", { n: symbols.value.length }));
    }
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_ELF") {
      message.error(t("crash.notElf"));
      return;
    }
    message.error(t("crash.elfFailed"));
  }
}

async function onPickHistoryElf(path: string | undefined) {
  if (!path || path === elfPath.value || elfLoading.value) {
    return;
  }
  try {
    const ok = await loadFirmwareElf(path);
    if (ok) {
      message.success(t("crash.elfLoaded", { n: symbols.value.length }));
    }
  } catch (e) {
    if (e instanceof Error && e.message === "ELF_MISSING") {
      message.warning(t("crash.elfMissing"));
      return;
    }
    if (e instanceof Error && e.message === "NOT_ELF") {
      message.error(t("crash.notElf"));
      return;
    }
    message.error(t("crash.elfFailed"));
  }
}

async function onExport() {
  try {
    const path = await exportReport(buildExportText());
    if (path) {
      message.success(t("crash.exportSuccess", { path }));
    }
  } catch {
    message.error(t("crash.exportFailed"));
  }
}
</script>

<style scoped>
.crash-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 100%;
  max-width: 100%;
  padding: 12px 16px 20px;
}

.panel {
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

.toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px 20px;
}

.tool-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1 1 280px;
  min-width: 0;
}

.tool-group-elf {
  flex: 1 1 240px;
}

.tool-kicker {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
}

.tool-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px;
}

.tool-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.export-btn {
  margin-left: auto;
}

.toolbar-hint,
.elf-hint {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.elf-history-select {
  flex: 1 1 160px;
  min-width: 140px;
  max-width: 280px;
}

.elf-opt {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 0;
  line-height: 1.3;
}

.elf-opt-name {
  font-size: 13px;
}

.elf-opt-path {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  word-break: break-all;
}

.elf-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.elf-progress-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
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
  word-break: break-all;
}

.panel-empty {
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tag {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 1px 6px;
  border-radius: 4px;
  line-height: 1.45;
  white-space: nowrap;
}

.tag-crit,
.tag-danger {
  background: rgba(255, 77, 79, 0.25);
  color: #ffccc7;
}

.tag-warn {
  background: rgba(250, 173, 20, 0.22);
  color: #ffe58f;
}

.tag-ok {
  background: rgba(82, 196, 26, 0.22);
  color: #b7eb8f;
}

.tag-code {
  background: rgba(24, 144, 255, 0.22);
  color: #91d5ff;
}

.tag-data {
  background: rgba(19, 194, 194, 0.2);
  color: #87e8de;
}

.tag-io {
  background: rgba(250, 173, 20, 0.22);
  color: #ffe58f;
}

.tag-ctrl {
  background: rgba(146, 84, 222, 0.25);
  color: #d3adf7;
}

.tag-muted {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.55);
}

.banner {
  padding: 14px 16px;
  border-radius: 10px;
}

.banner-crit {
  border: 1px solid rgba(255, 77, 79, 0.35);
  background: linear-gradient(90deg, rgba(255, 77, 79, 0.14), rgba(255, 77, 79, 0.03));
}

.banner-warn {
  border: 1px solid rgba(250, 173, 20, 0.4);
  background: linear-gradient(90deg, rgba(250, 173, 20, 0.14), rgba(250, 173, 20, 0.03));
}

.banner-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.banner-title {
  margin: 10px 0 8px;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  line-height: 1.3;
}

.banner-culprit {
  margin: 0 0 6px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.82);
}

.culprit-fn {
  font-weight: 600;
  color: #91d5ff;
  overflow-wrap: anywhere;
}

.dot {
  opacity: 0.35;
}

.banner-exc {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr));
  gap: 12px;
  align-items: start;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.backtrace {
  min-width: 0;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.panel-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.88);
}

.panel-meta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.identity {
  min-width: 0;
}

.kv {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.kv > div {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 8px;
  min-width: 0;
}

.kv dt {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.42);
}

.kv dd {
  margin: 0;
  min-width: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.88);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.kv-flow {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}

.kv-flow .sym,
.kv-flow .src-chip {
  flex: 1 1 100%;
}

.wrap {
  overflow-wrap: anywhere;
  word-break: break-word;
}

.sha {
  font-size: 11px;
  opacity: 0.85;
  overflow-wrap: anywhere;
  word-break: break-all;
}

.sha-warn {
  margin: 10px 0 0;
  font-size: 12px;
  color: #faad14;
  overflow-wrap: anywhere;
}

.pc-chip {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
  white-space: nowrap;
}

.pc-null {
  background: rgba(255, 77, 79, 0.2);
  color: #ffccc7;
}

.sym {
  min-width: 0;
  max-width: 100%;
  color: #69c0ff;
  font-size: 12px;
  overflow-wrap: anywhere;
  word-break: break-all;
}

.src-chip {
  display: inline-block;
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(82, 196, 26, 0.16);
  color: #b7eb8f;
  cursor: pointer;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-all;
}

.src-fn {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  overflow-wrap: anywhere;
}

.bt-src,
.bt-inline {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.bt-inline {
  margin-top: 2px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}

.bt-inline .src-chip {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.55);
}

.tag-crash {
  margin-left: 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 77, 79, 0.25);
  color: #ffccc7;
}

.bt-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bt-list li {
  display: flex;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
}

.bt-list li.top {
  border-color: rgba(255, 77, 79, 0.45);
  background: rgba(255, 77, 79, 0.1);
}

.bt-idx {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  width: 28px;
  padding-top: 2px;
}

.bt-sym {
  font-size: 13px;
  font-weight: 600;
  color: #e6f4ff;
  overflow-wrap: anywhere;
}

.bt-meta {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
}

.sp {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.hint-list {
  margin: 0;
  padding-left: 18px;
  color: rgba(255, 255, 255, 0.78);
  font-size: 13px;
  line-height: 1.65;
}

.reg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 6px;
}

.reg {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
}

.reg-hot {
  background: rgba(24, 144, 255, 0.12);
}

.reg-hit {
  background: rgba(255, 77, 79, 0.16);
}

.reg-name {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.reg code {
  font-size: 12px;
  cursor: pointer;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

:deep(.task-crash-row) td {
  background: rgba(255, 77, 79, 0.12) !important;
}
</style>
