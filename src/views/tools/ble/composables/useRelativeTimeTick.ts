import { onUnmounted, ref } from "vue";

/** 每秒递增，用于驱动「最近」等相对时间列重绘 */
export function useRelativeTimeTick(active = () => true, intervalMs = 1000) {
  const tick = ref(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  function start() {
    if (timer) {
      return;
    }
    timer = setInterval(() => {
      if (active()) {
        tick.value += 1;
      }
    }, intervalMs);
  }

  start();

  onUnmounted(() => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  });

  return tick;
}
