import { createApp } from "vue";
import router from "./router";
import App from "./App.vue";
import Antd from "ant-design-vue";
// import "ant-design-vue/dist/antd.dark.css";
import "./assets/css/style.css";
createApp(App).use(router).use(Antd).mount("#app");
