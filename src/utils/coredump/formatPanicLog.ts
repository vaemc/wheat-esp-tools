import type { BacktraceFrame, CoredumpReport, RegisterDump } from "./types";

/** Xtensa 真实异常原因数；coredump 里伪异常会加上这个偏移 */
const XCHAL_EXCCAUSE_NUM = 64;
const COREDUMP_INVALID_CAUSE = 0xffff;
const MAX_PANIC_DETAILS = 512;
const MAX_BACKTRACE_FRAMES = 32;

/** 与 ESP-IDF panic_arch.c 的 reason[] 对齐 */
const ARCH_REASON = [
  "IllegalInstruction",
  "Syscall",
  "InstructionFetchError",
  "LoadStoreError",
  "Level1Interrupt",
  "Alloca",
  "IntegerDivideByZero",
  "PCValue",
  "Privileged",
  "LoadStoreAlignment",
  "res",
  "res",
  "InstrPDAddrError",
  "LoadStorePIFDataError",
  "InstrPIFAddrError",
  "LoadStorePIFAddrError",
  "InstTLBMiss",
  "InstTLBMultiHit",
  "InstFetchPrivilege",
  "res",
  "InstrFetchProhibited",
  "res",
  "res",
  "res",
  "LoadStoreTLBMiss",
  "LoadStoreTLBMultihit",
  "LoadStorePrivilege",
  "res",
  "LoadProhibited",
  "StoreProhibited",
  "res",
  "res",
  "Cp0Dis",
  "Cp1Dis",
  "Cp2Dis",
  "Cp3Dis",
  "Cp4Dis",
  "Cp5Dis",
  "Cp6Dis",
  "Cp7Dis",
];

/** 与 PANIC_RSN_* / panic_soc_fill_info 对齐；Cache error 用串口常见写法 */
const PSEUDO_REASON = [
  "Unknown reason",
  "Unhandled debug exception",
  "Double exception",
  "Unhandled kernel exception",
  "Coprocessor exception",
  "Interrupt wdt timeout on CPU0",
  "Interrupt wdt timeout on CPU1",
  "Cache error",
];

function u32(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return n >>> 0;
}

function hex8(value: unknown): string {
  return `0x${u32(value).toString(16).padStart(8, "0")}`;
}

function sanitizeDetails(text: string | undefined | null): string {
  if (!text) {
    return "";
  }
  return text
    .replace(/\0/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_PANIC_DETAILS);
}

function decodeCause(exccause: number): { uartCause: number; pseudo: boolean } {
  const code = u32(exccause);
  if (code === COREDUMP_INVALID_CAUSE) {
    return { uartCause: 0, pseudo: false };
  }
  if (code >= XCHAL_EXCCAUSE_NUM && code < XCHAL_EXCCAUSE_NUM + PSEUDO_REASON.length) {
    return { uartCause: code - XCHAL_EXCCAUSE_NUM, pseudo: true };
  }
  return { uartCause: code, pseudo: false };
}

function guruReason(exccause: number, panicDetails: string): string {
  const details = panicDetails.toLowerCase();
  if (details.includes("cache") || details.includes("mmu")) {
    return "Cache error";
  }
  if (details.includes("watchdog") || details.includes("int wdt") || details.includes("interrupt wdt")) {
    if (details.includes("cpu1") || details.includes("core 1")) {
      return "Interrupt wdt timeout on CPU1";
    }
    return "Interrupt wdt timeout on CPU0";
  }
  if (/\babort\b/.test(details)) {
    return "abort() was called";
  }
  const { uartCause, pseudo } = decodeCause(exccause);
  if (pseudo) {
    return PSEUDO_REASON[uartCause] ?? "Unknown reason";
  }
  const name = ARCH_REASON[uartCause];
  if (!name || name === "res") {
    return "Unknown";
  }
  return name;
}

function formatRegDump(regs: RegisterDump, exccause: number, excvaddr: number): string {
  const { uartCause } = decodeCause(exccause);
  const a = Array.isArray(regs.a) ? regs.a : [];
  const entries: [string, number][] = [
    ["PC", u32(regs.pc)],
    ["PS", u32(regs.ps)],
    ["A0", u32(a[0])],
    ["A1", u32(a[1])],
    ["A2", u32(a[2])],
    ["A3", u32(a[3])],
    ["A4", u32(a[4])],
    ["A5", u32(a[5])],
    ["A6", u32(a[6])],
    ["A7", u32(a[7])],
    ["A8", u32(a[8])],
    ["A9", u32(a[9])],
    ["A10", u32(a[10])],
    ["A11", u32(a[11])],
    ["A12", u32(a[12])],
    ["A13", u32(a[13])],
    ["A14", u32(a[14])],
    ["A15", u32(a[15])],
    ["SAR", u32(regs.sar)],
    ["EXCCAUSE", uartCause],
    ["EXCVADDR", u32(regs.excvaddr ?? excvaddr)],
    ["LBEG", u32(regs.lbeg)],
    ["LEND", u32(regs.lend)],
    ["LCOUNT", u32(regs.lcount)],
  ];
  const lines: string[] = [];
  for (let i = 0; i < entries.length; i += 4) {
    lines.push(
      entries
        .slice(i, i + 4)
        .map(([name, value]) => `${name.padEnd(8, " ")}: ${hex8(value)}`)
        .join("  ")
    );
  }
  return lines.join("\n");
}

function formatBacktrace(frames: BacktraceFrame[] | undefined, corrupted: boolean): string {
  if (!frames?.length) {
    return "";
  }
  const body = frames
    .slice(0, MAX_BACKTRACE_FRAMES)
    .map((f) => `${hex8(f?.pc)}:${hex8(f?.sp)}`)
    .join(" ");
  return `Backtrace: ${body}${corrupted ? " |<-CORRUPTED" : ""}`;
}

function hasFullRegDump(regs: RegisterDump | null | undefined): boolean {
  return !!regs && Array.isArray(regs.a) && regs.a.length >= 16;
}

/** 还原 ESP-IDF 串口那种 Guru Meditation / 寄存器 / Backtrace 原文 */
export function formatIdfPanicLog(report: CoredumpReport, core = 0): string {
  if (!report || report.empty) {
    return "";
  }
  const details = sanitizeDetails(report.panicDetails);
  const hasRegs = hasFullRegDump(report.registers);
  const bt = formatBacktrace(report.backtrace, !!report.backtraceCorrupted);
  if (!hasRegs && !bt && !details && !u32(report.exccause)) {
    return "";
  }

  const cpu = core === 1 ? 1 : 0;
  const reason = guruReason(report.exccause, details);
  const { pseudo } = decodeCause(report.exccause);
  const alreadyGuru = /^guru meditation error:/i.test(details);
  const lines: string[] = [];

  if (alreadyGuru) {
    lines.push(details);
  } else {
    const guruTail = !pseudo && !details ? " Exception was unhandled." : "";
    lines.push(`Guru Meditation Error: Core  ${cpu} panic'ed (${reason}).${guruTail}`);
    if (details) {
      lines.push(details);
    }
  }

  if (hasRegs && report.registers) {
    lines.push(`Core  ${cpu} register dump:`);
    lines.push(formatRegDump(report.registers, report.exccause, report.excvaddr));
  }
  if (bt) {
    lines.push(bt);
  }
  return lines.join("\n");
}
