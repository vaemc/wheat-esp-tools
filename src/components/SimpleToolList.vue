<template>
  
  <div class="scroll" style="overflow: auto">
        <div style="display: flex; flex-wrap: wrap; justify-content: center">
          <a-tooltip v-for="item in customToolList" :key="item.name">
            <template #title v-if="item.toast != null">{{
              item.toast
            }}</template>
            <a-button size="small" @click="run(item.cmd)" style="margin: 5px">{{
              item.name
            }}</a-button>
          </a-tooltip>
          <!-- <a-tooltip>
            <template #title>读取固件</template>
            <a-button size="small" @click="readFirmware()" style="margin: 5px"
              >读取固件</a-button
            >
          </a-tooltip> -->
        </div>
      </div>

</template>
<script setup lang="ts">
import { ref } from "vue";
import { runCmd, generateCmd} from "../utils/esptool";
import { getSimpleToolList, saveFileDialog } from "../utils/common";
const customToolList = ref(await getSimpleToolList());
const run = async (data: string[]) => {
  let cmd = (await generateCmd(data)) as string[];
  runCmd(cmd);
};
const readFirmware = async () => {
  let savePath = (await saveFileDialog()) as string;
  console.log(savePath);

  let cmd = ["-p", "${port}", "flash_id"];
  cmd = (await generateCmd(cmd)) as string[];
  console.log(cmd);
 // saveFirmware(cmd, savePath);
};
</script>
