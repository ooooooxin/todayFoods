<script lang="ts" setup>
import { computed } from 'vue'
import { menuButtonInfo, systemInfo } from '@/utils/systemInfo'

const props = withDefaults(defineProps<Props>(), {
  text: '',
  textColor: 'text-main',
})

const DEFAULT_MAX_TEXT_LENGTH = 12

/**
 * H5 下没有胶囊按钮（menuButtonInfo.height = 0），此时 (height - 32)/2 会得到负值，
 * 导致标题被顶到屏幕最上方甚至被裁。统一兜底：当胶囊高度为 0 时，使用标准 44px 导航栏高度。
 */
const H5_FALLBACK_NAV_HEIGHT = 44

interface Props {
  text?: string
  textColor?: string
  /** 有值时括号与数量始终完整显示，紧跟文字；仅截断 text */
  count?: number | string
  maxTextLength?: number
}

const hasCount = computed(() => props.count !== undefined && props.count !== null)

const countSuffix = computed(() => `(${props.count})`)

const maxTextLength = computed(() => props.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH)

/** 超过 maxTextLength 个字时追加省略号；宽度不足时由 truncate 再裁切 */
const truncatedText = computed(() => {
  if (!props.text)
    return ''
  const max = maxTextLength.value
  return props.text.length > max ? `${props.text.slice(0, max)}...` : props.text
})

const titleLineHeightPx = uni.upx2px(44)

const titleLeft = computed(() => {
  const avatarLeftPx = 8
  const avatarWidthPx = 32
  const gapPx = 8
  return avatarLeftPx + avatarWidthPx + gapPx
})

const titleTop = computed(() => {
  // H5 兜底：胶囊高度为 0 时，以 statusBarHeight + 44px 导航栏居中
  const navHeight = menuButtonInfo.height || H5_FALLBACK_NAV_HEIGHT
  const baseTop = menuButtonInfo.height ? menuButtonInfo.top : (systemInfo.statusBarHeight || 0)
  return baseTop + (navHeight - titleLineHeightPx) / 2
})

/** 与 ipSeriesDetails headerButtonsRight 一致，标题右侧与胶囊按钮对齐 */
const titleRight = computed(() => {
  // #ifdef MP-TOUTIAO
  return `${systemInfo.windowWidth - menuButtonInfo.left + 10 + 56}px`
  // #endif
  // #ifndef MP-TOUTIAO
  return `${systemInfo.windowWidth - menuButtonInfo.left + 10}px`
  // #endif
})
</script>

<template>
  <view
    class="fixed z-999 text-32rpx font-bold leading-[44rpx]"
    :class="textColor"
    :style="{ left: `${titleLeft}px`, top: `${titleTop}px`, right: titleRight }"
  >
    <view v-if="hasCount" class="max-w-full min-w-0 w-fit flex items-center">
      <text class="min-w-0 flex-1 truncate">{{ truncatedText }}</text>
      <text class="shrink-0">{{ countSuffix }}</text>
    </view>
    <text v-else class="block min-w-0 truncate">{{ truncatedText }}</text>
  </view>
</template>
