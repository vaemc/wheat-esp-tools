
<template>
    <a-layout>
        <a-layout-sider style="height: 100vh;" collapsed-width="0" @collapse="onCollapse" @breakpoint="onBreakpoint">
            <a-menu :open-keys="openKeys" v-model:selectedKeys="selectedKeys" theme="dark" mode="inline">
                <a-sub-menu key="sub1">
                    <template #title>
                        <span>
                            🛠️工具列表
                        </span>
                    </template>
                    <!-- 🐶 🐱 🐭 🐹 🐰 🦊 🐻 -->
                    <a-menu-item key="1-1" @click="$router.push('/tools/basic')">🐼基本</a-menu-item>
                    <a-menu-item key="1-2" @click="$router.push('/tools/flash')">🐶烧录或合并固件</a-menu-item>
                    <a-menu-item key="1-3" @click="$router.push('/tools/partition')">🐱分区表</a-menu-item>
                    <a-menu-item key="1-4" @click="$router.push('/tools/fs')">🐻文件系统</a-menu-item>
                    <a-menu-item key="1-5" @click="$router.push('/tools/firmware')">🐰固件管理</a-menu-item>
                </a-sub-menu>
                <a-menu-item key="2">
                    <span class="nav-text">⚙️设置</span>
                </a-menu-item>
                <a-menu-item key="3">
                    <span class="nav-text">📙帮助</span>
                </a-menu-item>

            </a-menu>
        </a-layout-sider>
        <a-layout>
            <!-- <div style="margin: 10px;">
                <SerialPortSelect />
            </div> -->
            <a-layout-content :style="{ padding: '10px', minHeight: '280px' }">
                <router-view v-slot="{ Component }">
                    <keep-alive>
                        <component :is="Component" />
                    </keep-alive>
                </router-view>
            </a-layout-content>
            <Terminal />
        </a-layout>
    </a-layout>
</template>
<script setup lang="ts">
import Terminal from "@/components/Terminal.vue";
import SerialPortSelect from "@/components/SerialPortSelect.vue";
import { ref } from 'vue';

const openKeys = ref(['sub1']);

const onCollapse = (collapsed: boolean, type: string) => {
    console.log(collapsed, type);
};

const onBreakpoint = (broken: boolean) => {
    console.log(broken);
};

const selectedKeys = ref<string[]>(['4']);


</script>
  
  
  