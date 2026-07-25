import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { fileURLToPath, URL } from "node:url";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    vue(),
    // libopus-wasm：Emscripten 胶水会引用 Node 内置模块
    nodePolyfills({
      include: [
        "buffer",
        "path",
        "process",
        "util",
        "stream",
        "zlib",
        "fs",
        "module",
      ],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // 覆盖 libopus-wasm 的 node:module 等 node: 协议导入
      protocolImports: true,
    }),
  ],

  optimizeDeps: {
    include: ["buffer", "zlib"],
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
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        // 只拆相对独立的大库。不要把 vue 生态和剩余 node_modules
        // 硬拆成 vendor-vue / vendor，否则会出现循环 chunk：
        // vendor-vue -> vendor -> vendor-vue，运行时报
        // "Cannot access 'q' before initialization"。
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
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
