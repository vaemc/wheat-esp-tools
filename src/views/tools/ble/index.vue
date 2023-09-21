import { join } from 'path'; import { join } from 'path';
<template>
  <a-row>
    <a-col :span="16">
      <div style="height: calc(100vh - 160px); overflow: auto">
        <a-list size="small" item-layout="horizontal" :data-source="data">
          <template #renderItem="{ item }">
            <a-list-item>
              <template #actions>
                <span style="color: white"> {{ item.rssi }} dBm</span>
              </template>
              <template #extra>
                <div style="width: 80px">
                  <a-progress
                    :percent="100 - (moment().unix() - item.time) * 10"
                    :size="10"
                    :showInfo="false"
                  />
                </div>
              </template>
              <a-list-item-meta>
                <template #title>
                  {{ item.local_name }}
                </template>
                <template #avatar> </template>
                <template #description>
                  {{ item.address }}<br />

                  <a-tag
                    v-if="item.services.length != 0"
                    color="blue"
                    v-for="service in item.services"
                    >{{ service }}</a-tag
                  ><br />
                  <div style="margin: 3px 0"></div>
                  <a-tag v-if="item.adv.length != 0" color="cyan">{{
                    item.adv
                      .map((x: number) => x.toString(16).padStart(2, "0"))
                      .join("")
                      .toUpperCase()
                  }}</a-tag>
                </template>
              </a-list-item-meta>
            </a-list-item>
          </template>
        </a-list>
      </div></a-col
    >
    <a-col :span="8">
      <div style="margin: 5px">
        <a-button
          style="margin-bottom: 5px"
          type="primary"
          @click="scan"
          :danger="scanState"
          block
          >{{ scanBtnText }}</a-button
        >
        <a-card size="small" title="过滤">
          <a-input
            style="margin-bottom: 5px"
            v-model:value="filter.name"
            addon-before="名称"
          />
          <a-input
            style="margin-bottom: 5px"
            v-model:value="filter.address"
            addon-before="MAC"
          />
          <a-input
            style="margin-bottom: 5px"
            v-model:value="filter.adv"
            addon-before="广播包"
          />
          <a-input
            style="margin-bottom: 5px"
            v-model:value="filter.uuid"
            addon-before="UUID"
          />
          <a-input-number
            prefix="-"
            addon-before="RSSI"
            :min="1"
            :max="100"
            style="width: 100%"
            v-model:value="filter.rssi"
          />
          <a-slider
            style="margin-bottom: 5px"
            v-model:value="filter.rssi"
            :min="0"
            :max="100"
            tooltipPlacement="left"
            :tipFormatter="
              (x:number) => {
                return '-' + x;
              }
            "
          />

          <a-button type="primary" @click="reset" block>重置</a-button>
        </a-card>
      </div>
    </a-col>
  </a-row>
</template>
<script setup lang="ts">
import { ref, reactive } from "vue";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import { ReloadOutlined } from "@ant-design/icons-vue";
import { appWindow } from "@tauri-apps/api/window";
import moment from "moment";

const data = ref([] as any);
const scanBtnText = ref("开始扫描");
const scanState = ref(false);
const filter = reactive({
  name: "",
  address: "",
  adv: "",
  uuid: "",
  rssi: 100,
});

let timer = {} as NodeJS.Timer;

await listen("ble_advertisement_scan_event", (event: any) => {
  let peripheral = JSON.parse(event.payload);

  console.log(peripheral);

  if (!peripheral.local_name.includes(filter.name)) {
    return;
  }

  if (!peripheral.address.includes(filter.address)) {
    return;
  }

  if (
    peripheral.services.filter((x: string) => x.includes(filter.uuid)).length ==
      0 &&
    filter.uuid != ""
  ) {
    return;
  }

  if (!(peripheral.rssi >= -filter.rssi)) {
    return;
  }

  let ble = data.value.find((x: any) => x.address == peripheral.address);
  if (ble == undefined) {
    peripheral.time = moment().unix();
    data.value.push(peripheral);
  } else {
    data.value.map((item: any) => {
      if (item.address === peripheral.address) {
        item.rssi = peripheral.rssi;
        item.time = moment().unix();
      }
    });
  }
});

const reset = () => {
  filter.name = "";
  filter.address = "";
  filter.adv = "";
  filter.uuid = "";
  filter.rssi = 100;
};

const scan = async () => {
  if (scanState.value) {
    scanBtnText.value = "开始扫描";
    scanState.value = false;
    appWindow.emit("stop_ble_advertisement_scan", {});
    clearInterval(timer);
  } else {
    data.value = [];
    scanBtnText.value = "停止扫描";
    scanState.value = true;
    timer = setInterval(() => {
      data.value = data.value.filter(
        (x: any) => moment().unix() - x.time <= 10
      );
    }, 1000);
    await invoke("start_ble_advertisement_scan", {});
  }
};
</script>
