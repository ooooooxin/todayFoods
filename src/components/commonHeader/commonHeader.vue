<script setup lang="ts">
import { computed } from 'vue'
import { statusNavTotalHeight, systemInfo } from '@/utils/systemInfo'

const props = withDefaults(defineProps<Props>(), {
  scrollTop: 0,
  mode: 'fixed',
  triggerHeight: 0,
  bgColor: '',
  bgGradient: '',
})

/**
 * H5 下没有胶囊按钮，systemInfo.ts 里 menuButtonInfo.height = 0，导致
 * statusNavTotalHeight = statusBarHeight + 7 ≈ 7px，头部高度完全失效。
 * 这里以标准 44px 导航栏 + statusBarHeight 做 H5 兜底。
 */
const H5_FALLBACK_NAV_HEIGHT = 44

/**
 * Props 接口定义
 * @param scrollTop - 页面滚动距离，由父组件传入
 * @param mode - 模式：'fixed' 固定模式（使用 fixed 定位），'auto' 流式布局模式
 * @param triggerHeight - 固定模式下完全不透明的高度阈值（单位：px）
 */
interface Props {
  scrollTop?: number
  mode?: 'fixed' | 'auto'
  triggerHeight?: number
  bgColor?: string
  bgGradient?: string
}

/**
 * 头部高度 = 状态栏高度 + 导航栏高度
 */
const headerHeight = computed(() => {
  // H5 兜底：statusNavTotalHeight 在 H5 下只有 statusBarHeight + 7，实际不可用；
  // 当检测到小于合理最小高度时，使用 statusBarHeight + 44px 标准导航栏
  const MIN_VALID_HEIGHT = 30
  if (!statusNavTotalHeight || statusNavTotalHeight < MIN_VALID_HEIGHT) {
    return (systemInfo.statusBarHeight || 0) + H5_FALLBACK_NAV_HEIGHT
  }
  return statusNavTotalHeight
})

/**
 * 计算背景透明度
 * - fixed 模式：从导航栏底部开始渐显，到 triggerHeight 时完全不透明
 * - auto 模式：滚动距离达到导航栏高度时完全不透明
 */
const opacity = computed(() => {
  const scrollTop = props.scrollTop
  const startShowHeight = headerHeight.value

  if (props.mode === 'fixed') {
    // fixed 模式：滚动距离小于导航栏高度，完全透明
    if (scrollTop < startShowHeight) {
      return 0
    }
    // 计算从导航栏底部到触发高度的总滚动距离
    const maxScroll = props.triggerHeight - startShowHeight
    // 如果没有设置触发高度或已经超过，直接返回 1
    if (maxScroll <= 0) {
      return 1
    }
    // 计算透明度
    const currentOpacity = (scrollTop - startShowHeight) / maxScroll
    return Math.min(currentOpacity, 1)
  }
  else {
    // auto 模式：透明度 = 滚动距离 / 导航栏总高度
    return Math.min(scrollTop / headerHeight.value, 1)
  }
})
</script>

<template>
  <!--
    头部占位组件
    - fixed 模式：使用 fixed 定位，固定在顶部，根据滚动距离改变透明度实现渐隐渐现
    - auto 模式：使用流式布局（normal flow），不固定定位，跟随页面内容自然排列
  -->
  <view
    class="common-header"
    :class="{ 'common-header--fixed': mode === 'fixed' }"
    :style="{
      height: `${headerHeight}px`,
      background: bgGradient || bgColor || `rgba(255, 255, 255, ${opacity})`,
    }"
  />
</template>

<style scoped>
/**
 * 头部占位容器基础样式
 */
.common-header {
  width: 100%;
  z-index: 999;
  transition: background-color 0.15s linear;
}

/**
 * fixed 定位模式
 * 固定在页面顶部
 */
.common-header--fixed {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
}
</style>
