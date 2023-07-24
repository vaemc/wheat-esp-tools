<template>
  <div style="width: 100%">
    <div id="terminal" style="height: 160px" class="xterm"></div>
    <a-progress :percent="progress.value" v-if="progress.visible" :status="progress.status" :show-info="false" />
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { message } from "ant-design-vue";
import emitter from "../utils/bus";
import "xterm/css/xterm.css";
import "xterm/lib/xterm.js";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { onMounted } from "vue";

const progress = ref({
  value: 0,
  visible: false,
  status: "active",
});

const terminal = new Terminal({
  fontSize: 14,
  allowProposedApi: true,
  cursorStyle: "bar",
  theme: {
    background: "#202020",
    magenta: "#e39ef7",
  },
});

terminal.attachCustomKeyEventHandler((arg) => {
  if (arg.ctrlKey && arg.code === 'KeyC' && arg.type === 'keydown') {
    const selection = terminal.getSelection()
    if (selection) {
      navigator.clipboard.writeText(selection)
      return true
    }
  }
  return true
})


emitter.on("terminalWrite", (data) => {
  terminal.write(data as string);
});

emitter.on("terminalWriteLine", (data) => {
  terminal.writeln(data as string);

  let regex = /Writing at\s(0x[0-9a-fA-F]+)\.\.\.\s\((\d+)\s%\)/;
  let match = (data as string).match(regex);
  if (match) {
    const percentage = parseInt(match[2]);
    progress.value.visible = true;
    progress.value.value = percentage;
    progress.value.status = "active";

    if (percentage == 100) {
      progress.value.status = "normal";
    }
  }

  regex = /Detected flash size: (\d+)MB/;
  match = (data as string).match(regex);
  if (match) {
    message.info(`${match[1]}MB`);
  }
});

onMounted(() => {
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(document.getElementById("terminal") as HTMLElement);
  fitAddon.fit();
});
</script>
