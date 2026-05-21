export function basename(path: string): string {
  return path.replace(/^.*[\\/]/, "");
}

/** 从 flasher_args.json / idedata.json 路径提取工程名 */
export function getProjectLabel(path: string): string {
  const name = basename(path);
  if (name === "flasher_args.json" || name === "idedata.json") {
    const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
    return parts.length >= 3 ? parts[parts.length - 3] : name;
  }
  return name;
}
