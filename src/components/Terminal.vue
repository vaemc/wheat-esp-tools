<template>
  <div style="width: 100%;">
    <div id="terminal" style="height: 160px" class="xterm"></div>
  </div>
</template>
<script setup lang="ts">
import emitter from "../utils/bus";
import "xterm/css/xterm.css";
import "xterm/lib/xterm.js";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { onMounted } from "vue";
const terminal = new Terminal({
  fontSize: 14,
  allowProposedApi: true,
  cursorStyle: "bar",
  theme: {
    background: "#202020",
    magenta: "#e39ef7",
  },
});

emitter.on("terminalWrite", (data) => {
  terminal.write(data as string);
});

emitter.on("terminalWriteLine", (data) => {
  terminal.writeln(data as string);
});

onMounted(() => {
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(document.getElementById("terminal") as HTMLElement);
  fitAddon.fit();
});
</script>
