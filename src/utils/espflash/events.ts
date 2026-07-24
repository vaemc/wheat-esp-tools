import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { writeln } from "@/bus/terminal";
import i18n from "@/locales/i18n";
import { espflashLogLevel } from "@/utils/terminalLog";

export interface EspflashProgressPayload {
  jobId: string;
  op: string;
  phase: string;
  percent: number;
  messageKey: string;
  params?: Record<string, string>;
  addr?: number;
  current?: number;
  total?: number;
}

export interface EspflashLogPayload {
  jobId: string;
  messageKey: string;
  params?: Record<string, string>;
}

export type ProgressHandler = (payload: EspflashProgressPayload) => void;

let progressUnlisten: UnlistenFn | null = null;
let logUnlisten: UnlistenFn | null = null;
let listenersReady: Promise<void> | null = null;
const progressHandlers = new Set<ProgressHandler>();

/** 将 Rust 发来的 messageKey + params 渲染为当前语言文案 */
export function formatEspflashMessage(
  messageKey: string,
  params: Record<string, string> = {}
): string {
  if (!messageKey) {
    return "";
  }
  const path = `espflash.msg.${messageKey}`;
  const translated = i18n.global.t(path, params);
  // vue-i18n 找不到 key 时会原样返回 path
  if (translated === path) {
    return Object.keys(params).length
      ? `${messageKey} ${JSON.stringify(params)}`
      : messageKey;
  }
  return String(translated);
}

/** 将后端错误码（如 flash_size_unknown）转成可读文案 */
export function formatEspflashErrorDetail(raw: string): string {
  const code = (raw.split(":")[0] || raw).trim();
  const known: Record<string, string> = {
    flash_size_unknown: "flashSizeUnknown",
    no_segments: "noSegments",
    empty_file: "emptyFile",
    merge_too_large: "mergeTooLarge",
    segment_overlap: "segmentOverlap",
    offset_oob: "offsetOob",
    empty_offset_or_size: "emptyOffsetOrSize",
    read_corrupt: "readCorrupt",
    ESPFLASH_BUSY: "busy",
  };
  const msgKey = known[code];
  if (!msgKey) {
    return raw;
  }
  const path = `espflash.err.${msgKey}`;
  const translated = i18n.global.t(path);
  return translated === path ? raw : String(translated);
}

/** 确保全局进度/日志事件只订阅一次 */
export function ensureEspflashListeners(): Promise<void> {
  if (listenersReady) {
    return listenersReady;
  }
  listenersReady = (async () => {
    // 防止 HMR / 重复绑定留下旧监听 → 终端日志翻倍
    progressUnlisten?.();
    logUnlisten?.();
    progressUnlisten = null;
    logUnlisten = null;

    progressUnlisten = await listen<EspflashProgressPayload>(
      "espflash_progress",
      (event) => {
        const payload = event.payload;
        for (const handler of progressHandlers) {
          handler(payload);
        }
      }
    );
    logUnlisten = await listen<EspflashLogPayload>("espflash_log", (event) => {
      const { messageKey, params } = event.payload ?? {};
      if (!messageKey) {
        return;
      }
      writeln(
        formatEspflashMessage(messageKey, params ?? {}),
        espflashLogLevel(messageKey)
      );
    });
  })();
  return listenersReady;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposeEspflashListeners();
  });
}

export function onEspflashProgress(handler: ProgressHandler): () => void {
  progressHandlers.add(handler);
  void ensureEspflashListeners();
  return () => {
    progressHandlers.delete(handler);
  };
}

export function newEspflashJobId(prefix = "job"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function disposeEspflashListeners() {
  progressUnlisten?.();
  logUnlisten?.();
  progressUnlisten = null;
  logUnlisten = null;
  listenersReady = null;
  progressHandlers.clear();
}
