<template>
  <a-list size="small" bordered :data-source="pathList">
    <template #renderItem="{ item }">
      <a-list-item
        ><template #actions>
          <a @click="flash(item.full)">烧录</a>
          <a
            @click="
              () => {
                openFileInExplorer(item.full)
              }
            "
            >打开</a
          >
          <a @click="remove(item.full)">删除</a> </template
        >{{ item.full }}</a-list-item
      >
    </template>
  </a-list>
</template>
<script setup lang="ts">
import { message } from 'ant-design-vue'
import { openFileInExplorer } from '../utils/common'
import { Path } from '../utils/model'
import { ref } from 'vue'
import { historyPathStore } from '../utils/store'
const pathList = ref(historyPathStore().pathList as Path[])

const remove = (path: string) => {
  historyPathStore().pathList = historyPathStore().pathList.filter((x) => x.full !== path)
  pathList.value = historyPathStore().pathList
  message.success('删除成功!')
}

const emit = defineEmits<{
  (e: 'flash', path: string): void
}>()

function flash(path: string) {
  emit('flash', path)
}
</script>
