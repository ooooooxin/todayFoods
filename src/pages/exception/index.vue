<script lang="ts" setup>
import type { EmptyType } from '@/components/fg-empty/fg-empty.vue'
import { onHide, onLoad, onUnload } from '@dcloudio/uni-app'
import { ref } from 'vue'

definePage({
  style: {
    navigationBarTitleText: '',
  },
})

const emptyText = ref('')
const emptyType = ref<EmptyType>('content')
const showButton = ref<boolean>(false)
// 标记是否已经设置了刷新标志，避免重复设置
const hasSetRefreshFlag = ref(false)

onLoad((options) => {
  emptyType.value = options.type as EmptyType
  if (options.showButton === '1') {
    showButton.value = true
  }
  else {
    showButton.value = false
  }
  // 页面加载时重置标记
  hasSetRefreshFlag.value = false
})

function handleButtonClick() {
  if (emptyType.value === 'network') {
    setRefreshFlag()
    uni.navigateBack({ delta: 1 })
  }
}

// 设置刷新标志的函数，带重复执行保护
function setRefreshFlag() {
  if (!hasSetRefreshFlag.value) {
    hasSetRefreshFlag.value = true
    try {
      uni.setStorageSync('needRefreshFromException', '1')
    }
    catch (e) {
      console.error('设置刷新标志失败:', e)
    }
  }
}

// 在页面隐藏时设置刷新标志（用户点击返回或切换页面）
onHide(() => {
  setRefreshFlag()
})

// 在页面卸载时设置刷新标志（页面被销毁）
onUnload(() => {
  setRefreshFlag()
})
</script>

<template>
  <view class="h-screen flex items-center justify-center">
    <fg-empty :type="emptyType" :show-button="showButton" @button-click="handleButtonClick" />
  </view>
</template>

<style scoped lang="scss"></style>
