export const CONFIG_FILENAMES = {
  idf: "flasher_args.json",
  platformio: "idedata.json",
} as const;

export function basename(path: string): string {
  return path.replace(/^.*[\\/]/, "");
}

/** 从 flasher_args.json / idedata.json 路径提取工程名 */
export function getProjectLabel(path: string): string {
  const name = basename(path);
  if (
    name === CONFIG_FILENAMES.idf ||
    name === CONFIG_FILENAMES.platformio
  ) {
    const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
    return parts.length >= 3 ? parts[parts.length - 3] : name;
  }
  return name;
}
