import type { App, Directive, DirectiveBinding } from "vue";
import { message } from "ant-design-vue";
import i18n from "@/locales/i18n";

type CopyEl = HTMLElement & {
  _copyBinding?: DirectiveBinding;
  _copyHandler?: (e: Event) => void;
};

function resolveText(el: CopyEl) {
  const binding = el._copyBinding;
  if (binding?.value != null && binding.value !== "") {
    return String(binding.value);
  }
  return el.textContent?.trim() ?? "";
}

async function doCopy(el: CopyEl) {
  const text = resolveText(el);
  if (!text) {
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    message.success(i18n.global.t("common.copied"));
  } catch {
    message.error(i18n.global.t("common.copyFailed"));
  }
}

const vCopy: Directive = {
  mounted(el, binding) {
    const node = el as CopyEl;
    node._copyBinding = binding;
    node.classList.add("copyable");
    const handler = (e: Event) => {
      e.stopPropagation();
      void doCopy(node);
    };
    node._copyHandler = handler;
    node.addEventListener("click", handler);
  },
  updated(el, binding) {
    (el as CopyEl)._copyBinding = binding;
  },
  unmounted(el) {
    const node = el as CopyEl;
    if (node._copyHandler) {
      node.removeEventListener("click", node._copyHandler);
    }
  },
};

export function registerCopyDirective(app: App) {
  app.directive("copy", vCopy);
}
