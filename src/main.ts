import { createApp } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import App from "./App.vue";
import Antd from "ant-design-vue";
import "ant-design-vue/dist/antd.dark.css";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import "./assets/css/style.css";
import Upload from "./components/Upload.vue"

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

createApp(App).component("Upload",Upload).use(router).use(pinia).use(Antd).mount("#app");
