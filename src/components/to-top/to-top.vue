<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { usePageScrollStore } from '@/store/pageScroll'

interface Props {
  bottom?: string
}

const props = withDefaults(defineProps<Props>(), {
  bottom: '72rpx',
})

const pageScrollStore = usePageScrollStore()
const { scrollTop, backToTopSuppressed } = storeToRefs(pageScrollStore)

/** 超过 500rpx 显示；弹层占用 store 抑制时隐藏（根级与页面非同层，z-index 无效） */
const showBackToTop = computed(
  () => scrollTop.value > uni.upx2px(500) && !backToTopSuppressed.value,
)

const bottomStyle = computed(() => ({
  bottom: props.bottom || '72rpx',
}))

// 回到顶部
function handleClick() {
  pageScrollStore.setScrollTop(0)
  // 触发回到顶部信号，供页面监听
  pageScrollStore.triggerBackToTop()
  // 兼容使用页面滚动的页面
  uni.pageScrollTo({
    scrollTop: 0,
    duration: 300,
  })
}
</script>

<template>
  <view class="fixed right-30rpx z-50" :style="bottomStyle">
    <!-- 回到顶部按钮 -->
    <view v-if="showBackToTop" class="h-80rpx w-80rpx flex items-center justify-center rounded-full bg-[rgba(0,0,0,0.5)]" @click="handleClick">
      <i class="iconfont icon-zhiding text-36rpx text-[#fff]" />
    </view>
  </view>
</template>

<style scoped lang="scss"></style>
