import { createApp } from "vue";
import router from "./router";
import App from "./App.vue";
import Antd from "ant-design-vue";
import useClipboard from "vue-clipboard3";
import i18n from './locales/i18n'
const { toClipboard } = useClipboard();
import "./assets/css/style.css";

const app = createApp(App);

const message = {
  cn: {
    message: {
      hello: "你好",
    },
  },
  en: {
    message: {
      hello: "hello",
    },
  },
};



app.directive("copy", (el, binding) => {
  el.addEventListener("click", () => {
    toClipboard(el.textContent);
  });
});

app.use(router).use(i18n).use(Antd).mount("#app");
