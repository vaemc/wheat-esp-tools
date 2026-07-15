type HuffmanNode = {
  freq: number;
  byte: number | null;
  left: HuffmanNode | null;
  right: HuffmanNode | null;
};

function buildTree(data: Uint8Array): HuffmanNode | null {
  const freq = new Map<number, number>();
  for (const b of data) {
    freq.set(b, (freq.get(b) ?? 0) + 1);
  }
  const heap: HuffmanNode[] = [...freq.entries()].map(([byte, f]) => ({
    freq: f,
    byte,
    left: null,
    right: null,
  }));
  if (heap.length === 0) {
    return null;
  }
  // 单符号：补一个哑节点，保证树至少有分支（与部分嵌入式实现更兼容）
  if (heap.length === 1) {
    const only = heap[0];
    return {
      freq: only.freq,
      byte: null,
      left: only,
      right: { freq: 0, byte: (only.byte! + 1) % 256, left: null, right: null },
    };
  }
  heap.sort((a, b) => a.freq - b.freq);
  while (heap.length > 1) {
    const a = heap.shift()!;
    const b = heap.shift()!;
    const merged: HuffmanNode = {
      freq: a.freq + b.freq,
      byte: null,
      left: a,
      right: b,
    };
    let i = 0;
    while (i < heap.length && heap[i].freq < merged.freq) {
      i += 1;
    }
    heap.splice(i, 0, merged);
  }
  return heap[0] ?? null;
}

function buildCodeMap(
  node: HuffmanNode | null,
  prefix = "",
  map: Map<number, string> = new Map()
): Map<number, string> {
  if (!node) {
    return map;
  }
  if (node.byte !== null) {
    map.set(node.byte, prefix || "0");
    return map;
  }
  buildCodeMap(node.left, prefix + "0", map);
  buildCodeMap(node.right, prefix + "1", map);
  return map;
}

/**
 * Huffman 压缩。字典布局与 esp_emote_gfx / gif_to_aaf 一致：
 * [padding_bits][symbol, code_len, code_bytes...]...
 */
export function huffmanEncode(data: Uint8Array): {
  compressed: Uint8Array;
  dict: Uint8Array;
} {
  if (data.length === 0) {
    return { compressed: new Uint8Array(0), dict: new Uint8Array([0]) };
  }
  const tree = buildTree(data);
  const codeMap = buildCodeMap(tree);
  let encoded = "";
  for (const b of data) {
    encoded += codeMap.get(b) ?? "0";
  }
  const padding = (8 - (encoded.length % 8)) % 8;
  encoded += "0".repeat(padding);

  const compressed = new Uint8Array(encoded.length / 8);
  for (let i = 0; i < compressed.length; i++) {
    compressed[i] = parseInt(encoded.slice(i * 8, i * 8 + 8), 2);
  }

  const dictParts: number[] = [padding];
  for (const [byte, code] of codeMap) {
    dictParts.push(byte, code.length);
    const byteLen = Math.ceil(code.length / 8);
    const value = parseInt(code, 2);
    for (let i = byteLen - 1; i >= 0; i--) {
      dictParts.push((value >> (i * 8)) & 0xff);
    }
  }
  return { compressed, dict: new Uint8Array(dictParts) };
}

export function huffmanDecode(
  compressed: Uint8Array,
  dict: Uint8Array,
  expectedSize?: number
): Uint8Array {
  if (dict.length === 0) {
    return new Uint8Array(0);
  }
  const padding = dict[0];
  type Node = { left: Node | null; right: Node | null; byte: number | null };
  const root: Node = { left: null, right: null, byte: null };
  let pos = 1;
  while (pos < dict.length) {
    const symbol = dict[pos++];
    if (pos >= dict.length) {
      break;
    }
    const codeLen = dict[pos++];
    const codeByteLen = Math.ceil(codeLen / 8);
    if (pos + codeByteLen > dict.length) {
      break;
    }
    const codeBytes = dict.subarray(pos, pos + codeByteLen);
    pos += codeByteLen;
    let code = 0;
    for (const b of codeBytes) {
      code = (code << 8) | b;
    }
    const binary = code.toString(2).padStart(codeLen, "0").slice(-codeLen);
    let node = root;
    for (const bit of binary) {
      if (bit === "0") {
        node.left ??= { left: null, right: null, byte: null };
        node = node.left;
      } else {
        node.right ??= { left: null, right: null, byte: null };
        node = node.right;
      }
    }
    node.byte = symbol;
  }

  const totalBits = Math.max(0, compressed.length * 8 - padding);
  const out: number[] = [];
  let current = root;
  for (let i = 0; i < totalBits; i++) {
    const byte = compressed[i >> 3];
    const bit = (byte >> (7 - (i & 7))) & 1;
    current = bit ? current.right ?? root : current.left ?? root;
    if (current.byte !== null) {
      out.push(current.byte);
      current = root;
      if (typeof expectedSize === "number" && out.length >= expectedSize) {
        break;
      }
    }
  }
  if (typeof expectedSize === "number" && out.length < expectedSize) {
    const fill = out.length > 0 ? out[out.length - 1] : root.byte ?? 0;
    while (out.length < expectedSize) {
      out.push(fill);
    }
  }
  return new Uint8Array(
    typeof expectedSize === "number" ? out.slice(0, expectedSize) : out
  );
}
