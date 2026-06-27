<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'

definePage({
  style: {
    navigationBarTitleText: '',
    navigationStyle: 'default',
  },
})

const webUrl = ref('')
const pageTitle = ref('')

onLoad((options) => {
  if (options?.url) {
    webUrl.value = decodeURIComponent(options.url)
  }
  if (options?.title) {
    pageTitle.value = decodeURIComponent(options.title)
    uni.setNavigationBarTitle({ title: pageTitle.value })
  }
})
</script>

<template>
  <view class="h-screen flex flex-col bg-white">
    <web-view v-if="webUrl" :src="webUrl" />
    <fg-empty v-else type="load" text="加载失败" class="flex-1" />
  </view>
</template>
