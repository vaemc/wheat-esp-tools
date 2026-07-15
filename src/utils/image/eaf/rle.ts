/** RLE：[count, value] 对，count ∈ [1,255] */
export function rleEncode(data: Uint8Array): Uint8Array {
  if (data.length === 0) {
    return new Uint8Array(0);
  }
  const out: number[] = [];
  let prev = data[0];
  let count = 1;
  for (let i = 1; i < data.length; i++) {
    if (data[i] === prev && count < 255) {
      count += 1;
    } else {
      out.push(count, prev);
      prev = data[i];
      count = 1;
    }
  }
  out.push(count, prev);
  return new Uint8Array(out);
}

export function rleDecode(data: Uint8Array, expectedSize?: number): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i + 1 < data.length; i += 2) {
    const count = data[i];
    const value = data[i + 1];
    for (let j = 0; j < count; j++) {
      out.push(value);
    }
  }
  if (typeof expectedSize === "number" && out.length !== expectedSize) {
    if (out.length < expectedSize) {
      const fill = out.length > 0 ? out[out.length - 1] : 0;
      while (out.length < expectedSize) {
        out.push(fill);
      }
    } else {
      return new Uint8Array(out.slice(0, expectedSize));
    }
  }
  return new Uint8Array(out);
}
