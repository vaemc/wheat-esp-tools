import { formatPc } from "./parseDump";

export { parseCoredumpImage, formatPc } from "./parseDump";
export { parseFirmwareElf, lookupSymbol, extractAppElfSha256 } from "./elfSymbols";
export type { ElfParseProgress, ElfParsePhase } from "./elfSymbols";
export { diagnose } from "./diagnose";
export { describeExccause, processStackPc } from "./xtensa";
export { classifyEspAddr } from "./memoryMap";
export type { MemRegion } from "./memoryMap";
export type {
  CoredumpReport,
  Diagnosis,
  BacktraceFrame,
  SymbolHit,
  TaskInfo,
  RegisterDump,
  Addr2LineFrame,
  Addr2LineHit,
} from "./types";
export { lookupAddr2line } from "./addr2lineLookup";
export { formatIdfPanicLog } from "./formatPanicLog";

export function formatSymbol(sym: { name: string; offset: number }): string {
  return `${sym.name}+0x${sym.offset.toString(16)}`;
}

export function formatSourceLoc(frame: { file?: string; line?: number | null }): string {
  const file = (frame.file || "").replace(/^.*[\\/]/, "");
  if (!file) {
    return "";
  }
  if (frame.line) {
    return `${file}:${frame.line}`;
  }
  return file;
}

export function formatSourceCopy(frame: { file?: string; line?: number | null }): string {
  const file = frame.file || "";
  if (!file) {
    return "";
  }
  if (frame.line) {
    return `${file}:${frame.line}`;
  }
  return file;
}

export function formatAddr2lineCmd(elfPath: string, pcs: number[]): string {
  const elf = elfPath || "xiaozhi.elf";
  const addrs = pcs.map((pc) => formatPc(pc)).join(" ");
  return `xtensa-esp32s3-elf-addr2line -pfiaC -e "${elf}" ${addrs}`;
}
