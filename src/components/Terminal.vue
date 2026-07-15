<template>
  <div style="width: 100%">
    <div id="terminal" style="height: 160px" class="xterm"></div>
  </div>
</template>
<script setup lang="ts">
import "xterm/css/xterm.css";
import "xterm/lib/xterm.js";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { onMounted, onUnmounted } from "vue";
import bus from "@/bus/terminal";
import kleur from "kleur";
import { formatDateTime } from "@/utils/datetime";

const fitAddon = new FitAddon();

const terminal = new Terminal({
  fontSize: 14,
  allowProposedApi: true,
  cursorStyle: "bar",
  theme: {
    background: "#181818",
    magenta: "#e39ef7",
  },
});

terminal.attachCustomKeyEventHandler((arg) => {
  if (arg.ctrlKey && arg.code === "KeyC" && arg.type === "keydown") {
    const selection = terminal.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection);
      return false;
    }
  }
  return true;
});

function fit() {
  fitAddon.fit();
}

function onWriteLn(data: string) {
  terminal.writeln(
    `${kleur.bold().blue(`[${formatDateTime()}] `)}${data}`
  );
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
