/** EAF 解码帧 → 原生端 GIF 编码器使用的 RGBA dump（magic: WHEATRGB） */

const MAGIC = new TextEncoder().encode("WHEATRGB");

export function buildRgbaDump(
  frames: HTMLCanvasElement[],
  delayMs: number
): Uint8Array {
  if (frames.length === 0) {
    throw new Error("No frames");
  }
  const width = frames[0]!.width;
  const height = frames[0]!.height;
  const frameBytes = width * height * 4;
  const out = new Uint8Array(24 + frames.length * frameBytes);
  const view = new DataView(out.buffer);
  out.set(MAGIC, 0);
  view.setUint32(8, width, true);
  view.setUint32(12, height, true);
  view.setUint32(16, frames.length, true);
  view.setUint32(20, Math.max(10, Math.round(delayMs)), true);

  let offset = 24;
  for (const canvas of frames) {
    if (canvas.width !== width || canvas.height !== height) {
      throw new Error("Inconsistent frame size");
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("2D context unavailable");
    }
    const { data } = ctx.getImageData(0, 0, width, height);
    out.set(data, offset);
    offset += frameBytes;
  }
  return out;
}

export async function canvasToObjectUrl(
  canvas: HTMLCanvasElement
): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png"
    );
  });
  return URL.createObjectURL(blob);
}
