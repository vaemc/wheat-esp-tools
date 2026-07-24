<template>
  <section class="panel-body">
    <header class="panel-head">
      <div class="panel-head-text">
        <div class="panel-title-row">
          <span class="panel-title">{{ $t("firmware.localTitle") }}</span>
          <span class="panel-meta">
            {{ filteredItems.length }} {{ $t("firmware.itemUnit") }}
          </span>
        </div>
        <p class="panel-hint">{{ $t("firmware.localHint") }}</p>
      </div>
      <div class="panel-actions">
        <a-button size="small" :loading="loading" @click="refresh">
          {{ $t("firmware.refresh") }}
        </a-button>
        <a-button size="small" type="primary" ghost @click="openFirmwareDir">
          {{ $t("firmware.openFolder") }}
        </a-button>
      </div>
    </header>

    <a-input-search
      v-model:value="keyword"
      :placeholder="$t('firmware.search')"
      allow-clear
      class="panel-search"
    />

    <div class="item-scroll">
      <a-spin :spinning="loading">
        <div
          v-if="!loading && filteredItems.length === 0"
          class="firmware-empty"
        >
          <PlaceholderHint :text="$t('firmware.emptyLocal')" />
          <a-button type="primary" size="small" @click="openFirmwareDir">
            {{ $t("firmware.openFolder") }}
          </a-button>
        </div>
        <div v-else class="item-stack">
          <article
            v-for="item in pagedItems"
            :key="item.key"
            class="fw-item"
          >
            <div class="fw-item-main">
              <div class="fw-item-title-row">
                <span class="fw-item-title" :title="item.title">{{
                  item.title
                }}</span>
              </div>
              <div v-if="item.sizeLabel" class="fw-item-size">
                {{ item.sizeLabel }}
              </div>
            </div>
            <div class="fw-item-actions">
              <QuickFlashButton
                :path="item.path"
                :loading="flashingPath === item.path"
                @flash="onQuickFlash"
              />
              <a-button size="small" @click="openFileInExplorer(item.path)">
                {{ $t("firmware.open") }}
              </a-button>
              <a-popconfirm
                :title="$t('firmware.removeConfirm')"
                @confirm="remove(item.path)"
              >
                <a-button size="small" danger>
                  {{ $t("firmware.remove") }}
                </a-button>
              </a-popconfirm>
            </div>
          </article>
        </div>
      </a-spin>
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
import { message } from "ant-design-vue";
import PlaceholderHint from "@/components/PlaceholderHint.vue";
import { openDirectoryInExplorer, openFileInExplorer } from "@/utils/common";
import QuickFlashButton from "./QuickFlashButton.vue";
import { useQuickFlash } from "../composables/useQuickFlash";
import { useLocalFirmware } from "../composables/useLocalFirmware";

const baudRate = defineModel<string>("baudRate", { required: true });
const spiMode = defineModel<string>("spiMode", { required: true });
const eraseBeforeFlash = defineModel<boolean>("eraseBeforeFlash", {
  required: true,
});

const { t } = useI18n();
const flashOptions = { baudRate, spiMode, eraseBeforeFlash };
const { flashFirmware } = useQuickFlash(flashOptions);
const { keyword, filteredItems, loading, firmwareDir, refresh, remove } =
  useLocalFirmware();

const flashingPath = ref<string | null>(null);
const page = ref(1);
const pageSize = 8;

const pagedItems = computed(() => {
  const start = (page.value - 1) * pageSize;
  return filteredItems.value.slice(start, start + pageSize);
});

watch(keyword, () => {
  page.value = 1;
});

function openFirmwareDir() {
  if (firmwareDir.value) {
    openDirectoryInExplorer(firmwareDir.value);
  }
}

async function onQuickFlash(path: string) {
  if (flashingPath.value) {
    return;
  }
  flashingPath.value = path;
  try {
    await flashFirmware(path);
  } catch (e) {
    if (e instanceof Error && e.message === "NO_PORT") {
      message.warning(t("firmware.noPort"));
    } else if (e instanceof Error && e.message === "ESPFLASH_BUSY") {
      message.warning(t("espflash.busy"));
    } else if (e instanceof Error && e.message === "ESPTOOL_BUSY") {
      message.warning(t("espflash.busy"));
    } else {
      message.error(t("firmware.flashFailed"));
    }
  } finally {
    flashingPath.value = null;
  }
}
</script>
<style scoped>
.item-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
</style>
