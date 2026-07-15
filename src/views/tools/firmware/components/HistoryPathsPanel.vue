<template>
  <section class="panel-body">
    <header class="panel-head">
      <div class="panel-head-text">
        <div class="panel-title-row">
          <span class="panel-title">{{ $t("firmware.historyTitle") }}</span>
          <span class="panel-meta">
            {{ filteredItems.length }} {{ $t("firmware.itemUnit") }}
          </span>
        </div>
        <p class="panel-hint">{{ $t("firmware.historyHint") }}</p>
      </div>
    </header>

    <a-input-search
      v-model:value="keyword"
      :placeholder="$t('firmware.search')"
      allow-clear
      class="panel-search"
    />

    <div class="item-scroll">
      <div v-if="filteredItems.length === 0" class="firmware-empty">
        <PlaceholderHint :text="$t('firmware.emptyHistory')" />
      </div>
      <div v-else class="item-stack">
        <article
          v-for="item in pagedItems"
          :key="item.key"
          class="fw-item"
        >
          <div class="fw-item-main">
            <div class="fw-item-title-row">
              <a-tag
                :color="item.configType === 'idf' ? 'blue' : 'green'"
                class="type-tag"
              >
                {{ item.configType === "idf" ? "IDF" : "PIO" }}
              </a-tag>
              <span class="fw-item-title" :title="item.title">{{
                item.title
              }}</span>
            </div>
            <div class="fw-item-path" :title="item.description">
              {{ item.description }}
            </div>
          </div>
          <div class="fw-item-actions">
            <a-button type="primary" size="small" @click="onImport(item.path)">
              {{ $t("firmware.importFlash") }}
            </a-button>
            <a-button size="small" @click="openFileInExplorer(item.path)">
              {{ $t("firmware.open") }}
            </a-button>
            <a-popconfirm
              :title="$t('firmware.removeConfirm')"
              @confirm="historyStore.removePath(item.path)"
            >
              <a-button size="small" danger>
                {{ $t("firmware.remove") }}
              </a-button>
            </a-popconfirm>
          </div>
        </article>
      </div>
    </div>

    <div v-if="filteredItems.length > pageSize" class="panel-pagination">
      <a-pagination
        v-model:current="page"
        size="small"
        :total="filteredItems.length"
        :page-size="pageSize"
        :show-size-changer="false"
      />
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
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

const page = ref(1);
const pageSize = 8;

const pagedItems = computed(() => {
  const start = (page.value - 1) * pageSize;
  return filteredItems.value.slice(start, start + pageSize);
});

watch(keyword, () => {
  page.value = 1;
});

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
