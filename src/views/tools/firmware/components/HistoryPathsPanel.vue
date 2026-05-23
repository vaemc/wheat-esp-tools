<template>
  <section class="panel">
    <header class="panel-head">
      <span class="panel-title">{{ $t("firmware.historyTitle") }}</span>
      <span class="panel-meta">{{ filteredItems.length }} {{ $t("firmware.itemUnit") }}</span>
    </header>
    <p class="panel-hint">{{ $t("firmware.historyHint") }}</p>
    <a-input-search
      v-model:value="keyword"
      :placeholder="$t('firmware.search')"
      allow-clear
      class="panel-search"
    />
    <PlaceholderHint
      v-if="filteredItems.length === 0"
      :text="$t('firmware.emptyHistory')"
    />
    <a-list
      v-else
      class="item-list"
      size="small"
      bordered
      :data-source="filteredItems"
      :pagination="listPagination"
    >
      <template #renderItem="{ item }">
        <a-list-item>
          <a-list-item-meta>
            <template #title>
              <a-tag
                :color="item.configType === 'idf' ? 'blue' : 'green'"
                class="type-tag"
              >
                {{ item.configType === "idf" ? "IDF" : "PIO" }}
              </a-tag>
              <span class="item-title">{{ item.title }}</span>
            </template>
            <template #description>
              <span class="item-path" :title="item.description">{{
                item.description
              }}</span>
            </template>
          </a-list-item-meta>
          <template #actions>
            <a-button type="link" size="small" @click="onImport(item.path)">
              {{ $t("firmware.importFlash") }}
            </a-button>
            <a-button
              type="link"
              size="small"
              @click="openFileInExplorer(item.path)"
            >
              {{ $t("firmware.open") }}
            </a-button>
            <a-popconfirm
              :title="$t('firmware.removeConfirm')"
              @confirm="historyStore.removePath(item.path)"
            >
              <a-button type="link" size="small" danger>
                {{ $t("firmware.remove") }}
              </a-button>
            </a-popconfirm>
          </template>
        </a-list-item>
      </template>
    </a-list>
  </section>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { message } from "ant-design-vue";
import PlaceholderHint from "@/components/PlaceholderHint.vue";
import { openFileInExplorer } from "@/utils/common";
import { useHistoryStore } from "@/stores/history";
import { useImportToFlash } from "../composables/useImportToFlash";

const { t } = useI18n();
const historyStore = useHistoryStore();
const { keyword, filteredItems } = storeToRefs(historyStore);
const { importConfig } = useImportToFlash();

const listPagination = computed(() => ({
  pageSize: 10,
  size: "small" as const,
  hideOnSinglePage: true,
  showSizeChanger: false,
}));

async function onImport(path: string) {
  try {
    const ok = await importConfig(path);
    if (!ok) {
      message.warning(t("firmware.unsupportedConfig"));
    }
  } catch {
    message.error(t("firmware.importFailed"));
  }
}
</script>
