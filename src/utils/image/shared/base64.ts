function yieldToUi() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** 大 base64 分块解码，避免长时间阻塞主线程。 */
export async function base64ToBytesAsync(
  base64: string
): Promise<Uint8Array> {
  const chunkChars = 256 * 1024;
  if (base64.length <= chunkChars) {
    const bin = atob(base64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  }

  const parts: Uint8Array[] = [];
  let total = 0;
  let offset = 0;
  while (offset < base64.length) {
    let end = Math.min(offset + chunkChars, base64.length);
    if (end < base64.length) {
      end -= end % 4;
      if (end <= offset) {
        end = Math.min(offset + 4, base64.length);
      }
    }
    const bin = atob(base64.slice(offset, end));
    const chunk = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      chunk[i] = bin.charCodeAt(i);
    }
    parts.push(chunk);
    total += chunk.length;
    offset = end;
    await yieldToUi();
  }

  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}
