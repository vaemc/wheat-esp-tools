import { ref } from "vue";

const visible = ref(false);
const bootDone = ref(false);

/** 启动页显示控制：启动动画结束后可由侧栏 logo 开关 */
export function useAppSplash() {
  function show() {
    if (!bootDone.value) return;
    visible.value = true;
  }

  function hide() {
    visible.value = false;
  }

  function toggle() {
    if (!bootDone.value) return;
    visible.value = !visible.value;
  }

  function markBootDone() {
    bootDone.value = true;
    visible.value = false;
  }

  return {
    visible,
    bootDone,
    show,
    hide,
    toggle,
    markBootDone,
  };
}
