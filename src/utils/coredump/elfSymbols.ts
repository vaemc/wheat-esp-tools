import type { SymbolHit } from "./types";

interface ElfSymbol {
  name: string;
  value: number;
  size: number;
}

export type ElfParsePhase = "symbols" | "sha";

export interface ElfParseProgress {
  phase: ElfParsePhase;
  percent: number;
}

const SHT_SYMTAB = 2;
const SHT_DYNSYM = 11;
const STT_FUNC = 2;

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

/**
 * 对整份 ELF 文件做 SHA256。
 * 与 esptool elf2image 写入运行镜像 app_desc、以及 coredump/串口打印的指纹算法一致。
 * （磁盘 .elf 内 app_desc.app_elf_sha256 通常仍是编译占位 0，不能用来比对。）
 */
export async function hashElfFileSha256(buffer: Uint8Array): Promise<string> {
  // 显式拷到独立 ArrayBuffer，避免 SharedArrayBuffer / 类型收窄问题，且哈希范围恒为可见字节
  const ab = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(ab).set(buffer);
  const digest = await crypto.subtle.digest("SHA-256", ab);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** @deprecated 请用 hashElfFileSha256；保留别名以免外部旧调用断裂 */
export const extractAppElfSha256 = hashElfFileSha256;

/** dump 里的短 hex 与 ELF 文件哈希是否同一固件（前缀匹配，兼容 CONFIG_APP_RETRIEVE_LEN_ELF_SHA） */
export function elfShaMatches(dumpSha: string, fileSha: string): boolean {
  const a = dumpSha.replace(/[^0-9a-f]/gi, "").toLowerCase();
  const b = fileSha.replace(/[^0-9a-f]/gi, "").toLowerCase();
  if (!a || !b) {
    return false;
  }
  const n = Math.min(a.length, b.length);
  // 至少 8 个 hex 字符（4 字节），避免过短误判
  if (n < 8) {
    return false;
  }
  return a.slice(0, n) === b.slice(0, n);
}

/** 解析固件 ELF 的函数符号，并计算文件 SHA256（供与 coredump 指纹比对） */
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
  if (!eShoff || !eShnum || eShentsize < 40) {
    onProgress?.({ phase: "sha", percent: 0 });
    const sha256 = await hashElfFileSha256(buffer);
    onProgress?.({ phase: "sha", percent: 100 });
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
      if (type !== STT_FUNC) {
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
      result.push({ name, value: stValue >>> 0, size: stSize >>> 0 });
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
  onProgress?.({ phase: "sha", percent: 20 });
  await yieldToUi();

  const sha256 = await hashElfFileSha256(buffer);
  onProgress?.({ phase: "sha", percent: 100 });

  const funcs = result.sort((a, b) => a.value - b.value);

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
  let lo = 0;
  let hi = symbols.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const addr = symbols[mid].address;
    if (addr <= pc) {
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
