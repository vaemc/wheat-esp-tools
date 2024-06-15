import { createApp } from "vue";
import router from "./router";
import App from "./App.vue";
import Antd from "ant-design-vue";
import useClipboard from "vue-clipboard3";
import i18n from "./locales/i18n";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate)

const { toClipboard } = useClipboard();
const app = createApp(App);
import "./assets/css/style.css";


app.directive("copy", (el, binding) => {
  el.addEventListener("click", () => {
    toClipboard(el.textContent);
  });
});

app.use(router).use(pinia).use(i18n).use(Antd).mount("#app");
