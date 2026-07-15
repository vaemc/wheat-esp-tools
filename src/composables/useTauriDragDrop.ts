import {
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
} from "vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

type DragDropPayload = { paths?: string[] };

/**
 * 订阅 Tauri 窗口级拖放事件，但仅在当前 keep-alive 页面处于激活态时回调。
 * 避免多页面缓存后互相抢同一条拖放事件。
 */
export function useTauriDragDrop(handlers: {
  onDrop?: (paths: string[]) => void;
  onEnter?: () => void;
  onLeave?: () => void;
}) {
  const active = ref(false);
  const unlisteners: UnlistenFn[] = [];
  let cancelled = false;

  async function setup() {
    try {
      const offs = await Promise.all([
        listen<DragDropPayload>("tauri://drag-drop", (event) => {
          if (!active.value) {
            return;
          }
          const paths = event.payload?.paths ?? [];
          if (paths.length) {
            handlers.onDrop?.(paths);
          }
        }),
        listen("tauri://drag-enter", () => {
          if (!active.value) {
            return;
          }
          handlers.onEnter?.();
        }),
        listen("tauri://drag-leave", () => {
          if (!active.value) {
            return;
          }
          handlers.onLeave?.();
        }),
      ]);

      if (cancelled) {
        for (const off of offs) {
          try {
            off();
          } catch {
            /* noop */
          }
        }
        return;
      }
      unlisteners.push(...offs);
    } catch {
      /* browser / 非 Tauri 环境 */
    }
  }

  onMounted(() => {
    cancelled = false;
    active.value = true;
    void setup();
  });

  onActivated(() => {
    active.value = true;
  });

  onDeactivated(() => {
    active.value = false;
    handlers.onLeave?.();
  });

  onBeforeUnmount(() => {
    cancelled = true;
    active.value = false;
    for (const off of unlisteners) {
      try {
        off();
      } catch {
        /* noop */
      }
    }
    unlisteners.length = 0;
  });
}
