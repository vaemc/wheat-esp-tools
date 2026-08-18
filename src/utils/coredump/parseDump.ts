import type {
  BacktraceFrame,
  CoredumpReport,
  DumpHeader,
  LoadSegment,
  Note,
  RegisterDump,
  TaskInfo,
} from "./types";
import {
  COREDUMP_HEADER_SIZE,
  NOTE_ESP_CORE_DUMP_INFO,
  NOTE_ESP_EXTRA_INFO,
  NOTE_ESP_PANIC_DETAILS,
  NOTE_PRSTATUS,
  PT_LOAD,
  PT_NOTE,
} from "./types";
import {
  EXCCAUSE_INSTR_PROHIBITED,
  isLikelyExecutable,
  isLikelyStackPtr,
  parseXtExcFrame,
  parseXtensaExtraInfo,
  processStackPc,
  type XtExcFrame,
} from "./xtensa";

const MAX_PHDR = 256;
const MAX_NOTES = 64;
const MAX_NOTE_NAME = 256;
const COREDUMP_INVALID_CAUSE = 0xffff;
const COREDUMP_CURR_TASK_MARKER = 0xffffffff;
const FAKE_STACK_START = 0x20000000;
const FAKE_STACK_LIMIT = 0x30000000;

function u32(view: DataView, off: number): number {
  return view.getUint32(off, true);
}

function alignUp(n: number, a: number): number {
  return (n + a - 1) & ~(a - 1);
}

function decodeCString(data: Uint8Array, max = 256): string {
  const limit = Math.min(data.length, max);
  let end = 0;
  while (end < limit && data[end] !== 0) {
    end += 1;
  }
  return new TextDecoder().decode(data.subarray(0, end)).replace(/\0+$/, "");
}

function isFakeStack(addr: number): boolean {
  const a = addr >>> 0;
  return a >= FAKE_STACK_START && a < FAKE_STACK_LIMIT;
}

function isUsableCause(code: number | undefined): boolean {
  return code != null && code !== COREDUMP_INVALID_CAUSE;
}

function isErased(data: Uint8Array, n = 16): boolean {
  const m = Math.min(n, data.length);
  for (let i = 0; i < m; i++) {
    if (data[i] !== 0xff) {
      return false;
    }
  }
  return m > 0;
}

function findElfStart(data: Uint8Array): number {
  if (data.length >= 16 && data[12] === 0x7f && data[13] === 0x45) {
    return 12;
  }
  if (data[0] === 0x7f && data[1] === 0x45) {
    return 0;
  }
  for (let i = 0; i + 4 < Math.min(data.length, 64); i++) {
    if (data[i] === 0x7f && data[i + 1] === 0x45 && data[i + 2] === 0x4c && data[i + 3] === 0x46) {
      return i;
    }
  }
  return -1;
}

function parseNotes(elf: Uint8Array, phOff: number, phNum: number, phEnt: number): Note[] {
  const view = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  const notes: Note[] = [];
  const nphdr = Math.min(phNum, MAX_PHDR);
  for (let i = 0; i < nphdr; i++) {
    const o = phOff + i * phEnt;
    if (o + 32 > elf.length) {
      break;
    }
    if (u32(view, o) !== PT_NOTE) {
      continue;
    }
    const offset = u32(view, o + 4);
    const filesz = u32(view, o + 16);
    if (offset >= elf.length || filesz > elf.length) {
      continue;
    }
    let consumed = 0;
    while (consumed + 12 <= filesz && notes.length < MAX_NOTES) {
      const noteOff = offset + consumed;
      if (noteOff + 12 > elf.length) {
        break;
      }
      const namesz = u32(view, noteOff);
      const descsz = u32(view, noteOff + 4);
      const type = u32(view, noteOff + 8);
      if (namesz > MAX_NOTE_NAME || descsz > elf.length) {
        break;
      }
      const nameOff = noteOff + 12;
      const descOff = nameOff + alignUp(namesz, 4);
      if (descOff + descsz > elf.length) {
        break;
      }
      notes.push({
        name: decodeCString(elf.subarray(nameOff, nameOff + namesz)),
        type,
        desc: elf.subarray(descOff, descOff + descsz),
      });
      const step = 12 + alignUp(namesz, 4) + alignUp(descsz, 4);
      if (step < 12) {
        break;
      }
      consumed += step;
    }
  }
  return notes;
}

function parseLoadSegments(elf: Uint8Array, phOff: number, phNum: number, phEnt: number): LoadSegment[] {
  const view = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  const segs: LoadSegment[] = [];
  const nphdr = Math.min(phNum, MAX_PHDR);
  for (let i = 0; i < nphdr; i++) {
    const o = phOff + i * phEnt;
    if (o + 32 > elf.length) {
      break;
    }
    if (u32(view, o) !== PT_LOAD) {
      continue;
    }
    const fileOffset = u32(view, o + 4);
    const fileSize = u32(view, o + 16);
    if (fileOffset >= elf.length) {
      continue;
    }
    segs.push({
      fileOffset,
      vaddr: u32(view, o + 8),
      paddr: u32(view, o + 12),
      fileSize,
      memSize: u32(view, o + 20),
      flags: u32(view, o + 24),
    });
  }
  return segs;
}

function readVirt(segs: LoadSegment[], elf: Uint8Array, addr: number, len: number): Uint8Array | null {
  for (const seg of segs) {
    if (addr >= seg.vaddr && addr + len <= seg.vaddr + seg.fileSize) {
      const off = seg.fileOffset + (addr - seg.vaddr);
      if (off + len > elf.length) {
        return null;
      }
      return elf.subarray(off, off + len);
    }
  }
  return null;
}

function scanTaskName(tcb: Uint8Array): string {
  for (let i = 0; i + 4 < tcb.length; i++) {
    if (tcb[i] < 0x20 || tcb[i] > 0x7e) {
      continue;
    }
    let j = i;
    while (j < tcb.length && j - i < 16 && tcb[j] >= 0x20 && tcb[j] <= 0x7e) {
      j += 1;
    }
    if (j < tcb.length && tcb[j] === 0 && j - i >= 2) {
      const name = new TextDecoder().decode(tcb.subarray(i, j));
      if (/^[A-Za-z][A-Za-z0-9_./:-]{1,15}$/.test(name)) {
        return name;
      }
    }
  }
  return "";
}

function stackFrameAt(
  elf: Uint8Array,
  segs: LoadSegment[],
  tcbIndex: number
): { frame: XtExcFrame; stack: LoadSegment } | null {
  const next = segs[tcbIndex + 1];
  if (!next || next.fileSize < 88 || isFakeStack(next.vaddr)) {
    return null;
  }
  const end = Math.min(elf.length, next.fileOffset + next.fileSize);
  if (next.fileOffset >= elf.length || end - next.fileOffset < 88) {
    return null;
  }
  const stack = elf.subarray(next.fileOffset, end);
  const frame = parseXtExcFrame(
    new DataView(stack.buffer, stack.byteOffset, stack.byteLength),
    0
  );
  return frame ? { frame, stack: next } : null;
}

function isCrashExcFrame(frame: XtExcFrame): boolean {
  return frame.exit !== 0 && !isFakeStack(frame.pc) && !isFakeStack(frame.a[1] ?? 0);
}

function registersFromFrame(
  frame: XtExcFrame,
  extraCause?: number,
  extraVaddr?: number
): RegisterDump {
  return {
    pc: processStackPc(frame.pc),
    ps: frame.ps,
    a: frame.a,
    sar: frame.sar,
    exccause: extraCause ?? frame.exccause,
    excvaddr: extraVaddr ?? frame.excvaddr,
    lbeg: frame.lbeg,
    lend: frame.lend,
    lcount: frame.lcount,
  };
}
function parsePrStatusPcSp(desc: Uint8Array): { tcb: number; pc: number; sp: number } | null {
  // xtensa_elf_reg_dump_t: pr_status (72) + gregset
  // pr_pid at offset 24 of pr_status
  if (desc.length < 80) {
    return null;
  }
  const view = new DataView(desc.buffer, desc.byteOffset, desc.byteLength);
  const tcb = view.getUint32(24, true);
  const pc = view.getUint32(72, true);
  return { tcb, pc: pc >>> 0, sp: 0 };
}

function walkBacktrace(
  elf: Uint8Array,
  segs: LoadSegment[],
  framePc: number,
  frameSp: number,
  nextPc: number,
  stackVaddr: number,
  stackSize: number,
  firstExccause: number
): { frames: BacktraceFrame[]; corrupted: boolean } {
  const frames: BacktraceFrame[] = [];
  let pc = framePc >>> 0;
  let sp = frameSp >>> 0;
  let nxt = nextPc >>> 0;
  const maxDepth = 16;

  const firstPc = processStackPc(pc);
  frames.push({ pc: firstPc, sp });

  let corrupted = !(
    isLikelyStackPtr(sp) &&
    !isFakeStack(sp) &&
    (isLikelyExecutable(firstPc) || firstExccause === EXCCAUSE_INSTR_PROHIBITED)
  );

  let depth = maxDepth;
  while (depth-- > 0 && nxt && !corrupted) {
    if (isFakeStack(sp) || sp < stackVaddr || sp > stackVaddr + stackSize) {
      corrupted = true;
      break;
    }
    const save = readVirt(segs, elf, (sp - 16) >>> 0, 8);
    if (!save) {
      corrupted = true;
      break;
    }
    const sv = new DataView(save.buffer, save.byteOffset, save.byteLength);
    pc = nxt;
    nxt = sv.getUint32(0, true);
    sp = sv.getUint32(4, true);
    const outPc = processStackPc(pc);
    if (!isLikelyStackPtr(sp) || !isLikelyExecutable(outPc)) {
      corrupted = true;
      frames.push({ pc: outPc, sp });
      break;
    }
    frames.push({ pc: outPc, sp });
  }

  return { frames, corrupted };
}

function emptyReport(header: DumpHeader): CoredumpReport {
  return {
    header,
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
}

/** 解析从 Flash 读出的 coredump 分区（或裸 ELF / 带 12 字节头的 dump） */
export function parseCoredumpImage(data: Uint8Array): CoredumpReport {
  if (data.length < 16 || isErased(data)) {
    return emptyReport({ dataLen: 0, version: 0, chipRev: 0 });
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let header: DumpHeader = { dataLen: 0, version: 0, chipRev: 0 };
  const elfAt = findElfStart(data);
  if (elfAt < 0) {
    throw new Error("NOT_COREDUMP");
  }
  if (elfAt >= COREDUMP_HEADER_SIZE) {
    header = {
      dataLen: u32(view, 0),
      version: u32(view, 4),
      chipRev: u32(view, 8),
    };
    if (header.dataLen === 0xffffffff || header.dataLen < COREDUMP_HEADER_SIZE + 52) {
      return emptyReport(header);
    }
  }

  const elf = data.subarray(elfAt);
  if (elf.length < 52 || elf[0] !== 0x7f) {
    throw new Error("NOT_COREDUMP");
  }
  const ev = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  const phOff = u32(ev, 28);
  const phEnt = elf[42] | (elf[43] << 8);
  const phNum = elf[44] | (elf[45] << 8);
  if (!phOff || phOff >= elf.length || phEnt < 32 || phNum === 0) {
    throw new Error("NOT_COREDUMP");
  }
  const notes = parseNotes(elf, phOff, phNum, phEnt);
  const segs = parseLoadSegments(elf, phOff, phNum, phEnt);

  let panicDetails = "";
  let appElfSha256 = "";
  let coreDumpVersion = header.version;
  let extra = null as ReturnType<typeof parseXtensaExtraInfo>;

  for (const note of notes) {
    if (note.type === NOTE_ESP_PANIC_DETAILS) {
      panicDetails = decodeCString(note.desc, 512);
    } else if (note.type === NOTE_ESP_CORE_DUMP_INFO && note.desc.length >= 8) {
      const nv = new DataView(note.desc.buffer, note.desc.byteOffset, note.desc.byteLength);
      coreDumpVersion = nv.getUint32(0, true);
      appElfSha256 = decodeCString(note.desc.subarray(4), 80);
    } else if (note.type === NOTE_ESP_EXTRA_INFO) {
      extra = parseXtensaExtraInfo(note.desc);
    }
  }

  const crashedTcb =
    extra?.crashedTcb && extra.crashedTcb !== COREDUMP_CURR_TASK_MARKER ? extra.crashedTcb : 0;
  const extraCause = isUsableCause(extra?.exccause) ? extra?.exccause : undefined;
  const extraVaddr = extra?.excvaddr;
  const tasks: TaskInfo[] = [];
  let crashedTask = "";
  let registers: RegisterDump | null = null;
  let backtrace: BacktraceFrame[] = [];
  let backtraceCorrupted = false;
  let fallbackCrash: { name: string; tcb: number; frame: XtExcFrame; stack: LoadSegment } | null =
    null;

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const end = Math.min(elf.length, seg.fileOffset + seg.fileSize);
    if (seg.fileOffset >= elf.length || end <= seg.fileOffset) {
      continue;
    }
    const payload = elf.subarray(seg.fileOffset, end);
    const isTcb = crashedTcb !== 0 && seg.vaddr === crashedTcb;
    const looksLikeTcb = seg.fileSize >= 80 && seg.fileSize <= 512;
    if (!isTcb && !looksLikeTcb) {
      continue;
    }
    const name = scanTaskName(payload);
    const parsed = stackFrameAt(elf, segs, i);
    const pc = parsed ? processStackPc(parsed.frame.pc) : 0;
    const sp = parsed ? parsed.frame.a[1] >>> 0 : 0;
    if (name || isTcb) {
      tasks.push({
        tcbAddr: seg.vaddr,
        name: name || (isTcb ? "(crashed)" : ""),
        pc,
        sp,
        crashed: isTcb,
      });
    }
    if (isTcb && parsed && isCrashExcFrame(parsed.frame)) {
      crashedTask = name;
      registers = registersFromFrame(parsed.frame, extraCause, extraVaddr);
      const walked = walkBacktrace(
        elf,
        segs,
        parsed.frame.pc,
        parsed.frame.a[1],
        parsed.frame.a[0],
        parsed.stack.vaddr,
        parsed.stack.memSize || parsed.stack.fileSize,
        extraCause ?? parsed.frame.exccause
      );
      backtrace = walked.frames;
      backtraceCorrupted = walked.corrupted;
    } else if (!fallbackCrash && parsed && isCrashExcFrame(parsed.frame) && isLikelyExecutable(pc)) {
      fallbackCrash = { name, tcb: seg.vaddr, frame: parsed.frame, stack: parsed.stack };
    }
  }

  if (!registers && fallbackCrash) {
    crashedTask = fallbackCrash.name;
    registers = registersFromFrame(fallbackCrash.frame, extraCause, extraVaddr);
    const walked = walkBacktrace(
      elf,
      segs,
      fallbackCrash.frame.pc,
      fallbackCrash.frame.a[1],
      fallbackCrash.frame.a[0],
      fallbackCrash.stack.vaddr,
      fallbackCrash.stack.memSize || fallbackCrash.stack.fileSize,
      extraCause ?? fallbackCrash.frame.exccause
    );
    backtrace = walked.frames;
    backtraceCorrupted = walked.corrupted;
    const hit = tasks.find((t) => t.tcbAddr === fallbackCrash?.tcb);
    if (hit) {
      hit.crashed = true;
    } else {
      tasks.unshift({
        tcbAddr: fallbackCrash.tcb,
        name: fallbackCrash.name || "(crashed)",
        pc: processStackPc(fallbackCrash.frame.pc),
        sp: fallbackCrash.frame.a[1] >>> 0,
        crashed: true,
      });
    }
  }

  if (!registers) {
    const pr = notes.find((n) => n.type === NOTE_PRSTATUS);
    if (pr) {
      const parsed = parsePrStatusPcSp(pr.desc);
      if (parsed) {
        registers = { pc: processStackPc(parsed.pc), ps: 0, a: [] };
      }
    }
  }

  const uniqueTasks = new Map<number, TaskInfo>();
  for (const t of tasks) {
    uniqueTasks.set(t.tcbAddr, t);
  }

  return {
    header,
    empty: false,
    panicDetails,
    appElfSha256,
    coreDumpVersion,
    crashedTcb,
    crashedTask,
    isrContext: extra?.isrContext ?? false,
    exccause: extraCause ?? registers?.exccause ?? 0,
    excvaddr: extraVaddr ?? registers?.excvaddr ?? 0,
    registers,
    backtrace,
    backtraceCorrupted,
    tasks: [...uniqueTasks.values()],
    loadSegments: segs,
  };
}

export function formatPc(pc: number): string {
  return `0x${(pc >>> 0).toString(16).padStart(8, "0")}`;
}
