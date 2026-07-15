import {
  isNavigationFailure,
  useRoute,
  useRouter,
  type RouteRecordName,
} from "vue-router";

/** 侧栏菜单跳转 */
export function useMenuNavigation() {
  const route = useRoute();
  const router = useRouter();

  async function navigateTo(name: RouteRecordName) {
    if (route.name === name) {
      return;
    }

    try {
      await router.push({ name });
    } catch (error) {
      if (isNavigationFailure(error)) {
        return;
      }
      throw error;
    }
  }

  return { navigateTo };
}
