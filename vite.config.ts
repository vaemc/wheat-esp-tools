import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { fileURLToPath, URL } from "node:url";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // lv_font_conv 依赖；避免解析到损坏的 opentype.js@1.3.5
      "opentype.js": fileURLToPath(
        new URL(
          "./node_modules/lv_font_conv/node_modules/opentype.js/dist/opentype.js",
          import.meta.url
        )
      ),
    },
  },
  plugins: [
    vue(),
    // lv_font_conv（FreeType WASM + CommonJS）需要 Buffer / path 等 Node polyfill
    nodePolyfills({
      include: ["buffer", "path", "process", "util", "stream"],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],

  optimizeDeps: {
    include: [
      "lv_font_conv/lib/convert.js",
      "lv_font_conv/lib/collect_font_data.js",
      "buffer",
    ],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  // prevent vite from obscuring rust errors
  clearScreen: false,
  // tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
  },
  // to make use of `TAURI_ENV_*` and other env variables
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    commonjsOptions: {
      include: [/lv_font_conv/, /node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }
          if (id.includes("lv_font_conv")) {
            return "vendor-lvgl-font";
          }
          if (id.includes("ant-design-vue") || id.includes("@ant-design")) {
            return "vendor-antd";
          }
          if (
            id.includes("echarts") ||
            id.includes("vue-echarts") ||
            id.includes("zrender")
          ) {
            return "vendor-echarts";
          }
          if (id.includes("xterm")) {
            return "vendor-xterm";
          }
          if (
            id.includes("/vue/") ||
            id.includes("vue-router") ||
            id.includes("pinia") ||
            id.includes("@vue/")
          ) {
            return "vendor-vue";
          }
          return "vendor";
        },
      },
    },
    // Tauri webviews support es2021 (BigInt, etc.); avoid safari13 which rejects 0n
    target: "es2021",
    // don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
}));
