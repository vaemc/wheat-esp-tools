// vite.config.ts
import { defineConfig } from "file:///F:/2024/tauri/wheat-esp-tools/node_modules/vite/dist/node/index.js";
import vue from "file:///F:/2024/tauri/wheat-esp-tools/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import { nodePolyfills } from "file:///F:/2024/tauri/wheat-esp-tools/node_modules/vite-plugin-node-polyfills/dist/index.js";
import { fileURLToPath, URL } from "node:url";
var __vite_injected_original_import_meta_url = "file:///F:/2024/tauri/wheat-esp-tools/vite.config.ts";
var vite_config_default = defineConfig(async () => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url))
    }
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
        "module"
      ],
      globals: {
        Buffer: true,
        global: true,
        process: true
      },
      // 覆盖 libopus-wasm 的 node:module 等 node: 协议导入
      protocolImports: true
    })
  ],
  optimizeDeps: {
    include: ["buffer", "zlib"],
    esbuildOptions: {
      define: {
        global: "globalThis"
      }
    }
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  // prevent vite from obscuring rust errors
  clearScreen: false,
  // tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true
  },
  // to make use of `TAURI_ENV_*` and other env variables
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
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
          if (id.includes("echarts") || id.includes("vue-echarts") || id.includes("zrender")) {
            return "vendor-echarts";
          }
          if (id.includes("xterm")) {
            return "vendor-xterm";
          }
        }
      }
    },
    // Tauri webviews support es2021 (BigInt, etc.); avoid safari13 which rejects 0n
    target: "es2021",
    // don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJGOlxcXFwyMDI0XFxcXHRhdXJpXFxcXHdoZWF0LWVzcC10b29sc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRjpcXFxcMjAyNFxcXFx0YXVyaVxcXFx3aGVhdC1lc3AtdG9vbHNcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Y6LzIwMjQvdGF1cmkvd2hlYXQtZXNwLXRvb2xzL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHZ1ZSBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tdnVlXCI7XHJcbmltcG9ydCB7IG5vZGVQb2x5ZmlsbHMgfSBmcm9tIFwidml0ZS1wbHVnaW4tbm9kZS1wb2x5ZmlsbHNcIjtcclxuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgVVJMIH0gZnJvbSBcIm5vZGU6dXJsXCI7XHJcblxyXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoYXN5bmMgKCkgPT4gKHtcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICBcIkBcIjogZmlsZVVSTFRvUGF0aChuZXcgVVJMKFwiLi9zcmNcIiwgaW1wb3J0Lm1ldGEudXJsKSksXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgcGx1Z2luczogW1xyXG4gICAgdnVlKCksXHJcbiAgICAvLyBsaWJvcHVzLXdhc21cdUZGMUFFbXNjcmlwdGVuIFx1ODBGNlx1NkMzNFx1NEYxQVx1NUYxNVx1NzUyOCBOb2RlIFx1NTE4NVx1N0Y2RVx1NkEyMVx1NTc1N1xyXG4gICAgbm9kZVBvbHlmaWxscyh7XHJcbiAgICAgIGluY2x1ZGU6IFtcclxuICAgICAgICBcImJ1ZmZlclwiLFxyXG4gICAgICAgIFwicGF0aFwiLFxyXG4gICAgICAgIFwicHJvY2Vzc1wiLFxyXG4gICAgICAgIFwidXRpbFwiLFxyXG4gICAgICAgIFwic3RyZWFtXCIsXHJcbiAgICAgICAgXCJ6bGliXCIsXHJcbiAgICAgICAgXCJmc1wiLFxyXG4gICAgICAgIFwibW9kdWxlXCIsXHJcbiAgICAgIF0sXHJcbiAgICAgIGdsb2JhbHM6IHtcclxuICAgICAgICBCdWZmZXI6IHRydWUsXHJcbiAgICAgICAgZ2xvYmFsOiB0cnVlLFxyXG4gICAgICAgIHByb2Nlc3M6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICAgIC8vIFx1ODk4Nlx1NzZENiBsaWJvcHVzLXdhc20gXHU3Njg0IG5vZGU6bW9kdWxlIFx1N0I0OSBub2RlOiBcdTUzNEZcdThCQUVcdTVCRkNcdTUxNjVcclxuICAgICAgcHJvdG9jb2xJbXBvcnRzOiB0cnVlLFxyXG4gICAgfSksXHJcbiAgXSxcclxuXHJcbiAgb3B0aW1pemVEZXBzOiB7XHJcbiAgICBpbmNsdWRlOiBbXCJidWZmZXJcIiwgXCJ6bGliXCJdLFxyXG4gICAgZXNidWlsZE9wdGlvbnM6IHtcclxuICAgICAgZGVmaW5lOiB7XHJcbiAgICAgICAgZ2xvYmFsOiBcImdsb2JhbFRoaXNcIixcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxuXHJcbiAgLy8gVml0ZSBvcHRpb25zIHRhaWxvcmVkIGZvciBUYXVyaSBkZXZlbG9wbWVudCBhbmQgb25seSBhcHBsaWVkIGluIGB0YXVyaSBkZXZgIG9yIGB0YXVyaSBidWlsZGBcclxuICAvLyBwcmV2ZW50IHZpdGUgZnJvbSBvYnNjdXJpbmcgcnVzdCBlcnJvcnNcclxuICBjbGVhclNjcmVlbjogZmFsc2UsXHJcbiAgLy8gdGF1cmkgZXhwZWN0cyBhIGZpeGVkIHBvcnQsIGZhaWwgaWYgdGhhdCBwb3J0IGlzIG5vdCBhdmFpbGFibGVcclxuICBzZXJ2ZXI6IHtcclxuICAgIHBvcnQ6IDE0MjAsXHJcbiAgICBzdHJpY3RQb3J0OiB0cnVlLFxyXG4gIH0sXHJcbiAgLy8gdG8gbWFrZSB1c2Ugb2YgYFRBVVJJX0VOVl8qYCBhbmQgb3RoZXIgZW52IHZhcmlhYmxlc1xyXG4gIGVudlByZWZpeDogW1wiVklURV9cIiwgXCJUQVVSSV9cIl0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIGNvbW1vbmpzT3B0aW9uczoge1xyXG4gICAgICBpbmNsdWRlOiBbL25vZGVfbW9kdWxlcy9dLFxyXG4gICAgICB0cmFuc2Zvcm1NaXhlZEVzTW9kdWxlczogdHJ1ZSxcclxuICAgIH0sXHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIC8vIFx1NTNFQVx1NjJDNlx1NzZGOFx1NUJGOVx1NzJFQ1x1N0FDQlx1NzY4NFx1NTkyN1x1NUU5M1x1MzAwMlx1NEUwRFx1ODk4MVx1NjI4QSB2dWUgXHU3NTFGXHU2MDAxXHU1NDhDXHU1MjY5XHU0RjU5IG5vZGVfbW9kdWxlc1xyXG4gICAgICAgIC8vIFx1Nzg2Q1x1NjJDNlx1NjIxMCB2ZW5kb3ItdnVlIC8gdmVuZG9yXHVGRjBDXHU1NDI2XHU1MjE5XHU0RjFBXHU1MUZBXHU3M0IwXHU1RkFBXHU3M0FGIGNodW5rXHVGRjFBXHJcbiAgICAgICAgLy8gdmVuZG9yLXZ1ZSAtPiB2ZW5kb3IgLT4gdmVuZG9yLXZ1ZVx1RkYwQ1x1OEZEMFx1ODg0Q1x1NjVGNlx1NjJBNVxyXG4gICAgICAgIC8vIFwiQ2Fubm90IGFjY2VzcyAncScgYmVmb3JlIGluaXRpYWxpemF0aW9uXCJcdTMwMDJcclxuICAgICAgICBtYW51YWxDaHVua3MoaWQpIHtcclxuICAgICAgICAgIGlmICghaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXNcIikpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwiYW50LWRlc2lnbi12dWVcIikgfHwgaWQuaW5jbHVkZXMoXCJAYW50LWRlc2lnblwiKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3ItYW50ZFwiO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcImVjaGFydHNcIikgfHxcclxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJ2dWUtZWNoYXJ0c1wiKSB8fFxyXG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcInpyZW5kZXJcIilcclxuICAgICAgICAgICkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3ItZWNoYXJ0c1wiO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwieHRlcm1cIikpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLXh0ZXJtXCI7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICAvLyBUYXVyaSB3ZWJ2aWV3cyBzdXBwb3J0IGVzMjAyMSAoQmlnSW50LCBldGMuKTsgYXZvaWQgc2FmYXJpMTMgd2hpY2ggcmVqZWN0cyAwblxyXG4gICAgdGFyZ2V0OiBcImVzMjAyMVwiLFxyXG4gICAgLy8gZG9uJ3QgbWluaWZ5IGZvciBkZWJ1ZyBidWlsZHNcclxuICAgIG1pbmlmeTogIXByb2Nlc3MuZW52LlRBVVJJX0VOVl9ERUJVRyA/IFwiZXNidWlsZFwiIDogZmFsc2UsXHJcbiAgICAvLyBwcm9kdWNlIHNvdXJjZW1hcHMgZm9yIGRlYnVnIGJ1aWxkc1xyXG4gICAgc291cmNlbWFwOiAhIXByb2Nlc3MuZW52LlRBVVJJX0VOVl9ERUJVRyxcclxuICB9LFxyXG59KSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBaVIsU0FBUyxvQkFBb0I7QUFDOVMsT0FBTyxTQUFTO0FBQ2hCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsZUFBZSxXQUFXO0FBSHNJLElBQU0sMkNBQTJDO0FBTTFOLElBQU8sc0JBQVEsYUFBYSxhQUFhO0FBQUEsRUFDdkMsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxjQUFjLElBQUksSUFBSSxTQUFTLHdDQUFlLENBQUM7QUFBQSxJQUN0RDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLElBQUk7QUFBQTtBQUFBLElBRUosY0FBYztBQUFBLE1BQ1osU0FBUztBQUFBLFFBQ1A7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0EsU0FBUztBQUFBLFFBQ1AsUUFBUTtBQUFBLFFBQ1IsUUFBUTtBQUFBLFFBQ1IsU0FBUztBQUFBLE1BQ1g7QUFBQTtBQUFBLE1BRUEsaUJBQWlCO0FBQUEsSUFDbkIsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVBLGNBQWM7QUFBQSxJQUNaLFNBQVMsQ0FBQyxVQUFVLE1BQU07QUFBQSxJQUMxQixnQkFBZ0I7QUFBQSxNQUNkLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxNQUNWO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQTtBQUFBO0FBQUEsRUFJQSxhQUFhO0FBQUE7QUFBQSxFQUViLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLFlBQVk7QUFBQSxFQUNkO0FBQUE7QUFBQSxFQUVBLFdBQVcsQ0FBQyxTQUFTLFFBQVE7QUFBQSxFQUM3QixPQUFPO0FBQUEsSUFDTCxpQkFBaUI7QUFBQSxNQUNmLFNBQVMsQ0FBQyxjQUFjO0FBQUEsTUFDeEIseUJBQXlCO0FBQUEsSUFDM0I7QUFBQSxJQUNBLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFFBS04sYUFBYSxJQUFJO0FBQ2YsY0FBSSxDQUFDLEdBQUcsU0FBUyxjQUFjLEdBQUc7QUFDaEM7QUFBQSxVQUNGO0FBQ0EsY0FBSSxHQUFHLFNBQVMsZ0JBQWdCLEtBQUssR0FBRyxTQUFTLGFBQWEsR0FBRztBQUMvRCxtQkFBTztBQUFBLFVBQ1Q7QUFDQSxjQUNFLEdBQUcsU0FBUyxTQUFTLEtBQ3JCLEdBQUcsU0FBUyxhQUFhLEtBQ3pCLEdBQUcsU0FBUyxTQUFTLEdBQ3JCO0FBQ0EsbUJBQU87QUFBQSxVQUNUO0FBQ0EsY0FBSSxHQUFHLFNBQVMsT0FBTyxHQUFHO0FBQ3hCLG1CQUFPO0FBQUEsVUFDVDtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBO0FBQUEsSUFFQSxRQUFRO0FBQUE7QUFBQSxJQUVSLFFBQVEsQ0FBQyxRQUFRLElBQUksa0JBQWtCLFlBQVk7QUFBQTtBQUFBLElBRW5ELFdBQVcsQ0FBQyxDQUFDLFFBQVEsSUFBSTtBQUFBLEVBQzNCO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
