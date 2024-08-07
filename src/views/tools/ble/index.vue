<template>
  <a-row>
    <a-col :span="16">
      <div style="height: calc(100vh - 160px); overflow: auto">
        <a-list size="small" item-layout="horizontal" :data-source="data">
          <template #renderItem="{ item }">
            <a-list-item>
              <template #actions>
                <p style="color: white">{{ item.rssi }} dBm</p>
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
                  <p v-copy>{{ item.local_name }}</p>
                </template>
                <template #avatar> </template>
                <template #description>
                  <p v-copy>{{ item.address }}</p>

                  <a-tag
                    style="margin-bottom: 3px"
                    v-if="item.services.length != 0"
                    color="blue"
                    v-for="service in item.services"
                    v-copy
                    >{{ service }}</a-tag
                  >

                  <a-tag
                    style="margin-bottom: 3px"
                    v-if="item.adv.length != 0"
                    color="cyan"
                    v-copy
                    >{{
                      item.adv
                        .map((x: number) => x.toString(16).padStart(2, "0"))
                        .join(" ")
                        .toUpperCase()
                    }}</a-tag
                  >
                  <a-tag
                    style="margin-bottom: 3px"
                    v-if="Object.keys(item.manufacturer_data).length != 0"
                    color="cyan"
                    v-copy
                    >{{
                      Object.keys(item.manufacturer_data)
                        .map((x: any) => {
                          return item.manufacturer_data[x]
                            .map((x: number) => x.toString(16).padStart(2, "0"))
                            .join(" ")
                            .toUpperCase();
                        })
                        .join("")
                    }}</a-tag
                  >
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
        <a-card size="small" :title="$t('ble.filter')" style="margin-bottom: 5px">
          <a-input
            style="margin-bottom: 5px"
            v-model:value="filter.name"
            :addon-before="$t('ble.name')"
          />
          <a-input
            style="margin-bottom: 5px"
            v-model:value="filter.address"
            addon-before="MAC"
          />
          <a-input
            style="margin-bottom: 5px"
            v-model:value="filter.adv"
            :addon-before="$t('ble.advertising')"
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
            tooltipPlacement="bottom"
            :tipFormatter="
              (x:number) => {
                return '-' + x;
              }
            "
          />

          <a-button type="primary" @click="reset" block>{{
            i18n.global.t("ble.reset")
          }}</a-button>
        </a-card>
      </div>
    </a-col>
  </a-row>
</template>
<script setup lang="ts">
import { reactive, ref } from "vue";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import { appWindow } from "@tauri-apps/api/window";
import moment from "moment";
import i18n from "@/locales/i18n";
const data = ref([] as any);
const scanBtnText = ref(i18n.global.t("ble.startScanning"));
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
        item.manufacturer_data = peripheral.manufacturer_data;
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
    scanBtnText.value = i18n.global.t("ble.startScanning");
    scanState.value = false;
    appWindow.emit("stop_ble_advertisement_scan", {});
    clearInterval(timer);
  } else {
    data.value = [];
    scanBtnText.value = i18n.global.t("ble.stopScanning");
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
