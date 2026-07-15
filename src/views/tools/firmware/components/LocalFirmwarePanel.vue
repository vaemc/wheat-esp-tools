<template>
  <section class="panel">
    <header class="panel-head">
      <span class="panel-title">{{ $t("firmware.localTitle") }}</span>
      <a-button
        type="link"
        size="small"
        class="open-dir-btn"
        @click="openFirmwareDir"
      >
        {{ $t("firmware.openFolder") }}
      </a-button>
    </header>
    <p class="panel-hint">{{ $t("firmware.localHint") }}</p>
    <a-input-search
      v-model:value="keyword"
      :placeholder="$t('firmware.search')"
      allow-clear
      class="panel-search"
    />
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
                <span class="item-line">
                  <span class="item-title">{{ item.title }}</span>
                  <span v-if="item.sizeLabel" class="item-size">{{
                    item.sizeLabel
                  }}</span>
                </span>
              </template>
            </a-list-item-meta>
            <template #actions>
              <QuickFlashButton
                :path="item.path"
                :loading="flashingPath === item.path"
                v-model:baud-rate="baudRate"
                v-model:spi-mode="spiMode"
                v-model:erase-before-flash="eraseBeforeFlash"
                @flash="onQuickFlash"
              />
              <a-button
                type="link"
                size="small"
                @click="openFileInExplorer(item.path)"
              >
                {{ $t("firmware.open") }}
              </a-button>
              <a-popconfirm
                :title="$t('firmware.removeConfirm')"
                @confirm="remove(item.path)"
              >
                <a-button type="link" size="small" danger>
                  {{ $t("firmware.remove") }}
                </a-button>
              </a-popconfirm>
            </template>
          </a-list-item>
        </template>
      </a-list>
    </a-spin>
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "ant-design-vue";
import PlaceholderHint from "@/components/PlaceholderHint.vue";
import { openDirectoryInExplorer, openFileInExplorer } from "@/utils/common";
import QuickFlashButton from "./QuickFlashButton.vue";
import { useFlashOptions } from "@/composables/useFlashOptions";
import { useLocalFirmware } from "../composables/useLocalFirmware";
import { useQuickFlash } from "../composables/useQuickFlash";

const { t } = useI18n();
const flashOptions = useFlashOptions();
const { baudRate, spiMode, eraseBeforeFlash } = flashOptions;
const { flashFirmware } = useQuickFlash(flashOptions);
const { keyword, filteredItems, loading, firmwareDir, remove } =
  useLocalFirmware();

const flashingPath = ref<string | null>(null);

const listPagination = computed(() => ({
  pageSize: 10,
  size: "small" as const,
  hideOnSinglePage: true,
  showSizeChanger: false,
}));

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
    } else if (e instanceof Error && e.message === "ESPTOOL_BUSY") {
      message.warning(t("firmware.flashFailed"));
    } else {
      message.error(t("firmware.flashFailed"));
    }
  } finally {
    flashingPath.value = null;
  }
}
</script>
