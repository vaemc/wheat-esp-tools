import type { SymbolHit } from "./types";

interface ElfSymbol {
  name: string;
  value: number;
  size: number;
  type: number;
}

interface ProgramHeader {
  offset: number;
  vaddr: number;
  filesz: number;
  flags: number;
}

export type ElfParsePhase = "symbols" | "sha";

export interface ElfParseProgress {
  phase: ElfParsePhase;
  percent: number;
}

const SHT_SYMTAB = 2;
const SHT_DYNSYM = 11;
const STT_FUNC = 2;
const STT_OBJECT = 1;
const PT_LOAD = 1;
const PF_X = 1;
const PF_R = 4;
const APP_DESC_MAGIC = 0xabcd5432;
const APP_DESC_SHA_OFF = 4 + 4 + 8 + 32 + 32 + 16 + 16 + 32;

function readU16(view: DataView, off: number, le: boolean): number {
  return view.getUint16(off, le);
}

function readU32(view: DataView, off: number, le: boolean): number {
  return view.getUint32(off, le);
}

function cString(data: Uint8Array, start: number): string {
  let end = start;
  while (end < data.length && data[end] !== 0) {
    end += 1;
  }
  return new TextDecoder().decode(data.subarray(start, end));
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function maybeYield(clock: { last: number }): Promise<void> {
  const now = performance.now();
  if (now - clock.last < 24) {
    return;
  }
  clock.last = now;
  await yieldToUi();
}

function shaFromAppDesc(buffer: Uint8Array, fileOff: number): string {
  if (fileOff < 0 || fileOff + APP_DESC_SHA_OFF + 32 > buffer.length) {
    return "";
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (view.getUint32(fileOff, true) !== APP_DESC_MAGIC) {
    return "";
  }
  const sha = buffer.subarray(fileOff + APP_DESC_SHA_OFF, fileOff + APP_DESC_SHA_OFF + 32);
  return Array.from(sha)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function vaddrToFileOff(phdrs: ProgramHeader[], vaddr: number): number | null {
  for (const ph of phdrs) {
    if (vaddr >= ph.vaddr && vaddr < ph.vaddr + ph.filesz) {
      return ph.offset + (vaddr - ph.vaddr);
    }
  }
  return null;
}

function readProgramHeaders(
  view: DataView,
  buffer: Uint8Array,
  le: boolean
): ProgramHeader[] {
  const ePhoff = readU32(view, 28, le);
  const ePhentsize = readU16(view, 42, le);
  const ePhnum = readU16(view, 44, le);
  if (!ePhoff || !ePhnum || ePhentsize < 32) {
    return [];
  }
  const result: ProgramHeader[] = [];
  for (let i = 0; i < ePhnum; i++) {
    const off = ePhoff + i * ePhentsize;
    if (off + 32 > buffer.length) {
      break;
    }
    if (readU32(view, off, le) !== PT_LOAD) {
      continue;
    }
    result.push({
      offset: readU32(view, off + 4, le),
      vaddr: readU32(view, off + 8, le),
      filesz: readU32(view, off + 16, le),
      flags: readU32(view, off + 24, le),
    });
  }
  return result;
}

function extractShaFromSections(
  buffer: Uint8Array,
  view: DataView,
  le: boolean,
  sections: { name: string; offset: number; size: number }[]
): string {
  const preferred = sections.filter(
    (sec) =>
      sec.name.includes("appdesc") ||
      sec.name === ".rodata_desc" ||
      sec.name.endsWith(".appdesc")
  );
  for (const sec of preferred) {
    const sha = shaFromAppDesc(buffer, sec.offset);
    if (sha) {
      return sha;
    }
    const end = Math.min(buffer.length, sec.offset + sec.size);
    for (let i = sec.offset; i + APP_DESC_SHA_OFF + 32 <= end; i += 4) {
      if (view.getUint32(i, le) === APP_DESC_MAGIC) {
        const found = shaFromAppDesc(buffer, i);
        if (found) {
          return found;
        }
      }
    }
  }
  return "";
}

async function extractShaFromLoads(
  buffer: Uint8Array,
  view: DataView,
  le: boolean,
  phdrs: ProgramHeader[],
  onProgress: ((p: ElfParseProgress) => void) | undefined,
  clock: { last: number }
): Promise<string> {
  const candidates = phdrs.filter((ph) => (ph.flags & PF_X) === 0 && (ph.flags & PF_R) !== 0);
  const scan = candidates.length ? candidates : phdrs;
  const total = Math.max(
    1,
    scan.reduce((sum, ph) => sum + Math.max(0, ph.filesz), 0)
  );
  let scanned = 0;

  for (const ph of scan) {
    const start = ph.offset;
    const end = Math.min(buffer.length, ph.offset + ph.filesz);
    for (let i = start; i + APP_DESC_SHA_OFF + 32 <= end; i += 4) {
      if (view.getUint32(i, le) === APP_DESC_MAGIC) {
        const found = shaFromAppDesc(buffer, i);
        if (found) {
          onProgress?.({ phase: "sha", percent: 100 });
          return found;
        }
      }
      if ((i - start) % 65536 === 0) {
        const percent = Math.min(99, Math.round(((scanned + (i - start)) / total) * 100));
        onProgress?.({ phase: "sha", percent });
        await maybeYield(clock);
      }
    }
    scanned += ph.filesz;
  }
  onProgress?.({ phase: "sha", percent: 100 });
  return "";
}

/** 解析固件 ELF 的函数符号，并提取 app SHA256（供 PC 符号化） */
export async function parseFirmwareElf(
  buffer: Uint8Array,
  onProgress?: (p: ElfParseProgress) => void
): Promise<{ symbols: SymbolHit[]; sha256: string }> {
  if (buffer.length < 52 || buffer[0] !== 0x7f || buffer[1] !== 0x45) {
    throw new Error("NOT_ELF");
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const cls = buffer[4];
  const le = buffer[5] !== 2;
  if (cls !== 1) {
    throw new Error("ELF_NOT_32");
  }

  const clock = { last: 0 };
  onProgress?.({ phase: "symbols", percent: 0 });
  await yieldToUi();

  const eShoff = readU32(view, 32, le);
  const eShentsize = readU16(view, 46, le);
  const eShnum = readU16(view, 48, le);
  const eShstrndx = readU16(view, 50, le);
  const phdrs = readProgramHeaders(view, buffer, le);
  if (!eShoff || !eShnum || eShentsize < 40) {
    onProgress?.({ phase: "sha", percent: 0 });
    const sha256 = await extractShaFromLoads(buffer, view, le, phdrs, onProgress, clock);
    return { symbols: [], sha256 };
  }

  const shstr = readSection(view, buffer, eShoff, eShentsize, eShstrndx, le);
  const sections: {
    name: string;
    type: number;
    offset: number;
    size: number;
    entsize: number;
    link: number;
  }[] = [];
  for (let i = 0; i < eShnum; i++) {
    const sh = readSection(view, buffer, eShoff, eShentsize, i, le);
    const name = cString(shstr.data, sh.nameOff);
    sections.push({
      name,
      type: sh.type,
      offset: sh.offset,
      size: sh.size,
      entsize: sh.entsize,
      link: sh.link,
    });
  }

  const symbolSecs = sections.filter(
    (sec) => sec.type === SHT_SYMTAB || sec.type === SHT_DYNSYM
  );
  const totalSyms = symbolSecs.reduce((sum, sec) => {
    const entsize = sec.entsize || 16;
    return sum + Math.floor(sec.size / entsize);
  }, 0);

  const result: ElfSymbol[] = [];
  let appDescVaddr = 0;
  let done = 0;
  for (const sec of symbolSecs) {
    const strtab = sections[sec.link];
    if (!strtab) {
      const entsize = sec.entsize || 16;
      done += Math.floor(sec.size / entsize);
      continue;
    }
    const entsize = sec.entsize || 16;
    const count = Math.floor(sec.size / entsize);
    const strBytes = buffer.subarray(strtab.offset, strtab.offset + strtab.size);
    for (let i = 0; i < count; i++) {
      const off = sec.offset + i * entsize;
      done += 1;
      if (off + 16 > buffer.length) {
        break;
      }
      const stName = readU32(view, off, le);
      const stValue = readU32(view, off + 4, le);
      const stSize = readU32(view, off + 8, le);
      const stInfo = buffer[off + 12];
      const type = stInfo & 0xf;
      if (type !== STT_FUNC && type !== STT_OBJECT) {
        if (done % 2048 === 0 && totalSyms) {
          onProgress?.({
            phase: "symbols",
            percent: Math.round((done / totalSyms) * 100),
          });
          await maybeYield(clock);
        }
        continue;
      }
      if (!stValue) {
        continue;
      }
      const name = cString(strBytes, stName);
      if (!name || name.startsWith("$")) {
        continue;
      }
      if (type === STT_OBJECT && !appDescVaddr && name === "esp_app_desc") {
        appDescVaddr = stValue >>> 0;
      }
      result.push({ name, value: stValue >>> 0, size: stSize >>> 0, type });
      if (done % 2048 === 0 && totalSyms) {
        onProgress?.({
          phase: "symbols",
          percent: Math.round((done / totalSyms) * 100),
        });
        await maybeYield(clock);
      }
    }
  }

  onProgress?.({ phase: "symbols", percent: 100 });
  onProgress?.({ phase: "sha", percent: 8 });
  await yieldToUi();

  let sha256 = "";
  if (appDescVaddr) {
    const fileOff = vaddrToFileOff(phdrs, appDescVaddr);
    if (fileOff != null) {
      sha256 = shaFromAppDesc(buffer, fileOff);
    }
  }
  if (!sha256) {
    sha256 = extractShaFromSections(buffer, view, le, sections);
  }
  if (!sha256) {
    sha256 = await extractShaFromLoads(buffer, view, le, phdrs, onProgress, clock);
  } else {
    onProgress?.({ phase: "sha", percent: 100 });
  }

  const funcs = result
    .filter((s) => s.type === STT_FUNC)
    .sort((a, b) => a.value - b.value);

  return {
    symbols: funcs.map((s) => ({
      name: s.name,
      address: s.value,
      offset: 0,
    })),
    sha256,
  };
}

function readSection(
  view: DataView,
  buffer: Uint8Array,
  eShoff: number,
  eShentsize: number,
  index: number,
  le: boolean
) {
  const off = eShoff + index * eShentsize;
  return {
    nameOff: readU32(view, off, le),
    type: readU32(view, off + 4, le),
    offset: readU32(view, off + 16, le),
    size: readU32(view, off + 20, le),
    link: readU32(view, off + 24, le),
    entsize: readU32(view, off + 36, le),
    data: buffer.subarray(
      readU32(view, off + 16, le),
      readU32(view, off + 16, le) + readU32(view, off + 20, le)
    ),
  };
}

export function lookupSymbol(symbols: SymbolHit[], pc: number): SymbolHit | undefined {
  if (!symbols.length) {
    return undefined;
  }
  pc >>>= 0;
  let lo = 0;
  let hi = symbols.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (symbols[mid].address <= pc) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best < 0) {
    return undefined;
  }
  const hit = symbols[best];
  const next = symbols[best + 1];
  const span = next ? next.address - hit.address : 0x10000;
  if (pc - hit.address > Math.max(span, 0x4000)) {
    return undefined;
  }
  return {
    name: hit.name,
    address: hit.address,
    offset: (pc - hit.address) >>> 0,
  };
}

/** 从固件 ELF 提取 app 描述里的 SHA256（若存在） */
export function extractAppElfSha256(buffer: Uint8Array): string {
  if (buffer.length < 52 || buffer[0] !== 0x7f || buffer[1] !== 0x45) {
    return "";
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const le = buffer[5] !== 2;
  const phdrs = readProgramHeaders(view, buffer, le);
  const candidates = phdrs.filter((ph) => (ph.flags & PF_X) === 0 && (ph.flags & PF_R) !== 0);
  const scan = candidates.length ? candidates : phdrs;
  for (const ph of scan) {
    const start = ph.offset;
    const end = Math.min(buffer.length, ph.offset + ph.filesz);
    for (let i = start; i + APP_DESC_SHA_OFF + 32 <= end; i += 4) {
      if (view.getUint32(i, le) === APP_DESC_MAGIC) {
        const found = shaFromAppDesc(buffer, i);
        if (found) {
          return found;
        }
      }
    }
  }
  return "";
}
