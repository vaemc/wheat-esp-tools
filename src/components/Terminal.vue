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
import { onMounted } from "vue";
import bus from "@/bus/terminal";
import kleur from "kleur";
import moment from "moment";

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

window.onresize = () => {
  fitAddon.fit();
};

window.onpageshow = () => {
  fitAddon.fit();
};

bus.on("writeln", (data) => {
  terminal.writeln(
    `${kleur
      .bold()
      .blue(`[${moment().format("YYYY-MM-DD HH:mm:ss")}] `)}${data}`
  );
});

onMounted(() => {
  terminal.loadAddon(fitAddon);
  terminal.open(document.getElementById("terminal") as HTMLElement);
  fitAddon.fit();
});
</script>
