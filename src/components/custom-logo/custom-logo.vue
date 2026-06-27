<script setup lang="ts">
import { computed } from 'vue'
import { menuButtonInfo, systemInfo } from '@/utils/systemInfo'

interface Props {
  /** logo图片地址 */
  logoSrc?: string
  /** 是否是登录页（始终显示返回箭头，点击返回首页） */
  isLoginPage?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  logoSrc: '/static/images/default_picture.png',
  isLoginPage: false,
})

const emit = defineEmits<{
  /** 点击返回箭头 */
  (e: 'back'): void
}>()

/**
 * H5 下没有胶囊按钮（menuButtonInfo.height = 0），以标准 44px 导航栏做兜底，
 * 否则 logo/返回按钮会因 (0 - 32) / 2 = -16 被挤到屏幕最上方甚至被状态栏遮挡。
 */
const H5_FALLBACK_NAV_HEIGHT = 44

// logo/箭头距离左侧距离
const logoLeft = 8

// logo/箭头距离顶部距离（与胶囊按钮垂直居中）
const logoTop = computed(() => {
  const logoHeightPx = 32
  // H5 兜底：胶囊高度为 0 时，以 statusBarHeight + 44px 导航栏居中
  const navHeight = menuButtonInfo.height || H5_FALLBACK_NAV_HEIGHT
  const baseTop = menuButtonInfo.height ? menuButtonInfo.top : (systemInfo.statusBarHeight || 0)
  return baseTop + (navHeight - logoHeightPx) / 2
})

// 判断是否应该显示logo（页面栈只有当前一个页面时显示logo，登录页始终显示返回箭头）
const shouldShowLogo = computed(() => {
  if (props.isLoginPage)
    return false
  const pages = getCurrentPages()
  return pages.length <= 1
})

// 处理返回点击（登录页始终返回首页）
const handleBack = () => {
  const pages = getCurrentPages()
  if (props.isLoginPage && pages.length <= 1) {
    emit('back')
    uni.reLaunch({ url: '/pages/index/index' })
    return
  }
  emit('back')
  uni.navigateBack()
}

// 处理返回首页点击
const handleBackToHome = () => {
  uni.reLaunch({ url: '/pages/index/index' })
}
</script>

<template>
  <view
    class="fixed z-[1000] h-32px w-32px overflow-hidden rounded-full"
    :style="{ left: `${logoLeft}px`, top: `${logoTop}px` }"
  >
    <!-- 页面栈只有一页：显示logo -->
    <image
      v-if="shouldShowLogo"
      class="h-full w-full"
      :src="logoSrc"
      mode="aspectFit"
      @click="handleBackToHome"
    />
    <!-- 页面栈有多页：显示返回箭头 -->
    <view
      v-else
      class="h-full w-full flex items-center justify-center rounded-full"
      style="border: 1rpx solid rgba(0, 0, 0, 0.1); background-color: rgba(255, 255, 255, 0.5); box-sizing: border-box;"
      @click="handleBack"
    >
      <view class="i-carbon-chevron-left text-20px text-black/70" />
    </view>
  </view>
</template>
