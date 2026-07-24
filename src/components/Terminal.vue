<template>
  <div class="terminal-wrap">
    <div id="terminal" class="xterm terminal-host" />
  </div>
</template>
<script setup lang="ts">
import "xterm/css/xterm.css";
import "xterm/lib/xterm.js";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { onMounted, onUnmounted } from "vue";
import bus from "@/bus/terminal";
import {
  formatTerminalLine,
  type TerminalLine,
} from "@/utils/terminalLog";

const fitAddon = new FitAddon();

const terminal = new Terminal({
  fontSize: 13,
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  lineHeight: 1.35,
  allowProposedApi: true,
  cursorStyle: "bar",
  cursorBlink: false,
  scrollback: 4000,
  theme: {
    background: "#141414",
    foreground: "#e5e7eb",
    cursor: "#93c5fd",
    selectionBackground: "rgba(59, 130, 246, 0.35)",
    black: "#1f2937",
    red: "#f87171",
    green: "#4ade80",
    yellow: "#fbbf24",
    blue: "#60a5fa",
    magenta: "#e879f9",
    cyan: "#22d3ee",
    white: "#f3f4f6",
    brightBlack: "#6b7280",
    brightRed: "#fca5a5",
    brightGreen: "#86efac",
    brightYellow: "#fde68a",
    brightBlue: "#93c5fd",
    brightMagenta: "#f0abfc",
    brightCyan: "#67e8f9",
    brightWhite: "#ffffff",
  },
});

terminal.attachCustomKeyEventHandler((arg) => {
  if (arg.ctrlKey && arg.code === "KeyC" && arg.type === "keydown") {
    const selection = terminal.getSelection();
    if (selection) {
      void navigator.clipboard.writeText(selection);
      return false;
    }
  }
  return true;
});

function fit() {
  fitAddon.fit();
}

function onWriteLn(data: string | TerminalLine) {
  terminal.writeln(formatTerminalLine(data));
}

onMounted(() => {
  const el = document.getElementById("terminal");
  if (!el) {
    console.error("[Terminal] #terminal element not found");
    return;
  }
  terminal.loadAddon(fitAddon);
  terminal.open(el);
  fitAddon.fit();
  window.addEventListener("resize", fit);
  window.addEventListener("pageshow", fit);
  bus.on("writeln", onWriteLn);
});

onUnmounted(() => {
  window.removeEventListener("resize", fit);
  window.removeEventListener("pageshow", fit);
  bus.off("writeln", onWriteLn);
  terminal.dispose();
});
</script>
<style scoped>
.terminal-wrap {
  width: 100%;
}

.terminal-host {
  height: 160px;
  padding: 4px 8px 6px;
  box-sizing: border-box;
}
</style>
