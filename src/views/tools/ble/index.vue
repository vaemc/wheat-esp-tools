import { join } from 'path';
<template>
  <a-float-button @click="aaa" type="primary" :style="{
    right: '24px',
    marginBottom: '90px'
  }">
    <template #icon>
      <ReloadOutlined />
    </template>
    <template #tooltip>
      <div>刷新</div>
    </template>
  </a-float-button>
  <div style="height: calc(100vh - 160px); overflow: auto">
    <a-list size="small" item-layout="horizontal" :data-source="data">
      <template #renderItem="{ item }">
        <a-list-item>
          <template #actions>
            <span style="color: white"> {{ item.rssi }} dBm</span>
          </template>
          <a-list-item-meta :description="item.address">
            <template #title>
              <a href="https://www.antdv.com/">{{ item.local_name }}</a>
            </template>
          </a-list-item-meta>
          <a-tag color="#108ee9" v-for="service in item.services">{{ service }}</a-tag>
        </a-list-item>
      </template>
    </a-list>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import { ReloadOutlined } from "@ant-design/icons-vue";

const data = ref([] as any);

await listen("ble_device_scan_event", (event: any) => {
  console.log(JSON.parse(event.payload));
  data.value.push(JSON.parse(event.payload));
});
const aaa = async () => {
  data.value = [];
  await invoke("ble_device_scan", {});
};
</script>
