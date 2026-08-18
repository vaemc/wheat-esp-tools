/** ESP-IDF Flash core dump（ELF）解析类型 */

export interface DumpHeader {
  dataLen: number;
  version: number;
  chipRev: number;
}

export interface LoadSegment {
  vaddr: number;
  paddr: number;
  fileOffset: number;
  fileSize: number;
  memSize: number;
  flags: number;
}

export interface Note {
  name: string;
  type: number;
  desc: Uint8Array;
}

export interface TaskInfo {
  tcbAddr: number;
  name: string;
  pc: number;
  sp: number;
  /** 是否为崩溃任务 */
  crashed: boolean;
}

export interface BacktraceFrame {
  pc: number;
  sp: number;
  symbol?: SymbolHit;
}

export interface SymbolHit {
  name: string;
  address: number;
  offset: number;
  /** 来自 ELF 的编译单元文件名（若有） */
  file?: string;
  line?: number;
  column?: number;
}

export interface Addr2LineFrame {
  function: string;
  file: string;
  line: number | null;
  column: number | null;
}

export interface Addr2LineHit {
  address: number;
  frames: Addr2LineFrame[];
}

export interface RegisterDump {
  pc: number;
  ps: number;
  a: number[];
  sar?: number;
  exccause?: number;
  excvaddr?: number;
  lbeg?: number;
  lend?: number;
  lcount?: number;
}

export interface CoredumpReport {
  header: DumpHeader;
  empty: boolean;
  panicDetails: string;
  appElfSha256: string;
  coreDumpVersion: number;
  crashedTcb: number;
  crashedTask: string;
  isrContext: boolean;
  exccause: number;
  excvaddr: number;
  registers: RegisterDump | null;
  backtrace: BacktraceFrame[];
  backtraceCorrupted: boolean;
  tasks: TaskInfo[];
  loadSegments: LoadSegment[];
}

export interface Diagnosis {
  severity: "critical" | "warning" | "info";
  causeKey: string;
  hintKeys: string[];
  exceptionName: string;
  exceptionExplainKey: string;
}

export const NOTE_ESP_CORE_DUMP_INFO = 8266;
export const NOTE_ESP_EXTRA_INFO = 677;
export const NOTE_ESP_PANIC_DETAILS = 679;
export const NOTE_PRSTATUS = 1;

export const PT_LOAD = 1;
export const PT_NOTE = 4;

export const COREDUMP_HEADER_SIZE = 12;
export const SHA256_LEN = 32;
