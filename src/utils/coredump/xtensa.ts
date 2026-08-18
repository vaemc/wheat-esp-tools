/** Xtensa EXCCAUSE 与窗口化 ABI 回溯 */

const EXCCAUSE: Record<number, { name: string; explainKey: string }> = {
  0: { name: "IllegalInstruction", explainKey: "crash.exc.illegalInstruction" },
  1: { name: "Syscall", explainKey: "crash.exc.syscall" },
  2: { name: "InstructionFetchError", explainKey: "crash.exc.ifetchError" },
  3: { name: "LoadStoreError", explainKey: "crash.exc.loadStoreError" },
  4: { name: "Level1Interrupt", explainKey: "crash.exc.interrupt" },
  5: { name: "Alloca", explainKey: "crash.exc.alloca" },
  6: { name: "IntegerDivideByZero", explainKey: "crash.exc.divZero" },
  8: { name: "Privileged", explainKey: "crash.exc.privileged" },
  9: { name: "LoadStoreAlignment", explainKey: "crash.exc.alignment" },
  18: { name: "InstrFetchPrivilege", explainKey: "crash.exc.ifetchPriv" },
  20: { name: "InstrFetchProhibited", explainKey: "crash.exc.ifetchProhibited" },
  28: { name: "LoadProhibited", explainKey: "crash.exc.loadProhibited" },
  29: { name: "StoreProhibited", explainKey: "crash.exc.storeProhibited" },
  32: { name: "Coprocessor0Disabled", explainKey: "crash.exc.coproc" },
  33: { name: "Coprocessor1Disabled", explainKey: "crash.exc.coproc" },
  34: { name: "Coprocessor2Disabled", explainKey: "crash.exc.coproc" },
  35: { name: "Coprocessor3Disabled", explainKey: "crash.exc.coproc" },
};

export const EXCCAUSE_INSTR_PROHIBITED = 20;

export function describeExccause(code: number): { name: string; explainKey: string } {
  if (code >= 32 && code <= 39) {
    return {
      name: `Coprocessor${code - 32}Disabled`,
      explainKey: "crash.exc.coproc",
    };
  }
  return (
    EXCCAUSE[code] ?? {
      name: `EXCCAUSE_${code}`,
      explainKey: "crash.exc.unknown",
    }
  );
}

/** Windowed ABI：a0 高 2 位是窗口增量，映射回代码地址 */
export function processStackPc(pc: number): number {
  pc >>>= 0;
  if (pc & 0x80000000) {
    return ((pc & 0x3fffffff) | 0x40000000) >>> 0;
  }
  return pc;
}

export function isLikelyExecutable(pc: number): boolean {
  pc = processStackPc(pc);
  return pc >= 0x40000000 && pc < 0x50000000;
}

export function isLikelyStackPtr(sp: number): boolean {
  sp >>>= 0;
  if ((sp & 0xf) !== 0 || sp < 0x100) {
    return false;
  }
  // DRAM / RTC / PSRAM 常见区间
  return (
    (sp >= 0x3f400000 && sp < 0x40000000) ||
    (sp >= 0x50000000 && sp < 0x64000000)
  );
}

export interface XtExcFrame {
  exit: number;
  pc: number;
  ps: number;
  a: number[];
  sar: number;
  exccause: number;
  excvaddr: number;
  lbeg: number;
  lend: number;
  lcount: number;
}

/** 从任务栈顶解析 Xtensa 异常帧 */
export function parseXtExcFrame(view: DataView, offset: number): XtExcFrame | null {
  if (offset + 88 > view.byteLength) {
    return null;
  }
  const a: number[] = [];
  for (let i = 0; i < 16; i++) {
    a.push(view.getUint32(offset + 12 + i * 4, true));
  }
  const hasLoops = offset + 100 <= view.byteLength;
  return {
    exit: view.getUint32(offset + 0, true),
    pc: view.getUint32(offset + 4, true),
    ps: view.getUint32(offset + 8, true),
    a,
    sar: view.getUint32(offset + 76, true),
    exccause: view.getUint32(offset + 80, true),
    excvaddr: view.getUint32(offset + 84, true),
    lbeg: hasLoops ? view.getUint32(offset + 88, true) : 0,
    lend: hasLoops ? view.getUint32(offset + 92, true) : 0,
    lcount: hasLoops ? view.getUint32(offset + 96, true) : 0,
  };
}

export interface ExtraInfo {
  crashedTcb: number;
  exccause: number;
  excvaddr: number;
  isrContext: boolean;
}

/** ESP_EXTRA_INFO note（Xtensa） */
export function parseXtensaExtraInfo(desc: Uint8Array): ExtraInfo | null {
  if (desc.length < 20) {
    return null;
  }
  const view = new DataView(desc.buffer, desc.byteOffset, desc.byteLength);
  const crashedTcb = view.getUint32(0, true);
  const exccause = view.getUint32(8, true);
  const excvaddr = view.getUint32(16, true);
  const isrContext = desc.length >= 152 ? view.getUint32(148, true) !== 0 : false;
  return { crashedTcb, exccause, excvaddr, isrContext };
}
