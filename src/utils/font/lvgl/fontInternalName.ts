/** 从 TTF/OTF 的 name 表读取面向用户的字体名称（优先族名）。 */

function readU16(view: DataView, offset: number): number {
  return view.getUint16(offset, false);
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

function decodeNameString(
  bytes: Uint8Array,
  platformID: number,
  encodingID: number,
  offset: number,
  length: number
): string | null {
  if (offset < 0 || length <= 0 || offset + length > bytes.length) {
    return null;
  }
  const slice = bytes.subarray(offset, offset + length);

  // Windows / Unicode UCS-2 BE
  if (
    platformID === 3 ||
    platformID === 0 ||
    (platformID === 2 && encodingID === 1)
  ) {
    if (length % 2 !== 0) {
      return null;
    }
    const codes: number[] = [];
    for (let i = 0; i < slice.length; i += 2) {
      codes.push((slice[i]! << 8) | slice[i + 1]!);
    }
    return String.fromCharCode(...codes).trim() || null;
  }

  // Mac Roman（常见英文族名）
  try {
    return new TextDecoder("latin1").decode(slice).trim() || null;
  } catch {
    return null;
  }
}

interface NameCandidate {
  nameID: number;
  platformID: number;
  languageID: number;
  text: string;
}

function scoreName(c: NameCandidate): number {
  // 优先：Typographic Family(16) > Font Family(1) > Full name(4) > PostScript(6)
  const idScore =
    c.nameID === 16 ? 400 : c.nameID === 1 ? 300 : c.nameID === 4 ? 200 : c.nameID === 6 ? 100 : 0;
  // Windows Unicode / Unicode platform 更可靠（含中文）
  const platScore =
    c.platformID === 3 ? 30 : c.platformID === 0 ? 20 : c.platformID === 1 ? 5 : 0;
  // 简体中文 / 英文
  const langScore =
    c.languageID === 0x0804 || c.languageID === 0x0404
      ? 10
      : c.languageID === 0x0409
        ? 8
        : 0;
  return idScore + platScore + langScore;
}

/**
 * 读取字体文件内建名称；失败返回 null。
 * 优先 Typographic Family / Font Family。
 */
export function readFontInternalName(bytes: Uint8Array): string | null {
  if (bytes.length < 12) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = readU16(view, 4);
  if (numTables <= 0 || 12 + numTables * 16 > bytes.length) {
    return null;
  }

  let nameOffset = -1;
  let nameLength = 0;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = String.fromCharCode(
      bytes[rec]!,
      bytes[rec + 1]!,
      bytes[rec + 2]!,
      bytes[rec + 3]!
    );
    if (tag === "name") {
      nameOffset = readU32(view, rec + 8);
      nameLength = readU32(view, rec + 12);
      break;
    }
  }
  if (nameOffset < 0 || nameLength < 6 || nameOffset + nameLength > bytes.length) {
    return null;
  }

  const count = readU16(view, nameOffset + 2);
  const stringOffset = readU16(view, nameOffset + 4);
  const storageBase = nameOffset + stringOffset;
  const candidates: NameCandidate[] = [];

  for (let i = 0; i < count; i++) {
    const rec = nameOffset + 6 + i * 12;
    if (rec + 12 > nameOffset + nameLength) {
      break;
    }
    const platformID = readU16(view, rec);
    const encodingID = readU16(view, rec + 2);
    const languageID = readU16(view, rec + 4);
    const nameID = readU16(view, rec + 6);
    const length = readU16(view, rec + 8);
    const offset = readU16(view, rec + 10);
    if (![1, 4, 6, 16].includes(nameID)) {
      continue;
    }
    const text = decodeNameString(
      bytes,
      platformID,
      encodingID,
      storageBase + offset,
      length
    );
    if (text) {
      candidates.push({ nameID, platformID, languageID, text });
    }
  }

  if (candidates.length === 0) {
    return null;
  }
  candidates.sort((a, b) => scoreName(b) - scoreName(a));
  return candidates[0]!.text;
}
