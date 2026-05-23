import { onMounted, ref } from "vue";
import {
  isNavigationFailure,
  useRoute,
  useRouter,
  type RouteRecordName,
} from "vue-router";

let navToken = 0;

/** 侧栏菜单跳转：等待路由就绪，并以最后一次点击为准，避免启动时快速切换导致导航丢失 */
export function useMenuNavigation() {
  const route = useRoute();
  const router = useRouter();
  const ready = ref(false);

  onMounted(async () => {
    await router.isReady();
    ready.value = true;
  });

  async function navigateTo(name: RouteRecordName) {
    if (!ready.value) {
      await router.isReady();
    }

    if (route.name === name) {
      return;
    }

    const token = ++navToken;

    const push = () =>
      router.push({ name }).catch((error) => {
        if (isNavigationFailure(error)) {
          return;
        }
        throw error;
      });

    await push();

    if (token !== navToken) {
      return;
    }

    if (route.name !== name) {
      await push();
    }
  }

  return { navigateTo };
}
