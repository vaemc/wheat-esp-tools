import { createApp } from "vue";
import router from "./router";
import App from "./App.vue";
import Antd from "ant-design-vue";
import i18n from "./locales/i18n";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import { registerCopyDirective } from "./directives/copy";

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

const app = createApp(App);
import "./assets/css/style.css";

registerCopyDirective(app);

app.use(router).use(pinia).use(i18n).use(Antd).mount("#app");
