<script lang="ts" setup>
import { nextTick, ref, watch } from 'vue'
import { systemInfo } from '@/utils/systemInfo'

interface Tab {
  id: number
  thumbUrl: string
}

interface Props {
  tabs: Tab[]
  currentIndex: number
  /** 是否有上一页数据 */
  hasPrev?: boolean
  /** 是否有下一页数据 */
  hasNext?: boolean
  /** 加载完成标记，用于触发重置（值变化时重置触发标记） */
  loadCompleteKey?: number
  /** 为 true 时点击 Tab 不触发 change（与预览区手势切换串行） */
  switchLocked?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  hasPrev: false,
  hasNext: false,
  switchLocked: false,
})

const emit = defineEmits<{
  (e: 'change', index: number): void
  (e: 'load-more', direction: 'PREV' | 'NEXT'): void
}>()

// 屏幕宽度 (用于计算居中位置)
const screenWidthPx = systemInfo.windowWidth

// 核心状态
const scrollLeftValue = ref(0)
const scrollWithAnimation = ref(false)
const trackedScrollLeft = ref(0)

// PREV 加载导致 currentIndex 偏移时，抑制 watch 自动居中
let suppressNextAutoScroll = false

// 标记是否已触发加载（防止重复触发）
const hasTriggeredPrevLoad = ref(false)
const hasTriggeredNextLoad = ref(false)

// RPX 常量定义 (严格匹配你的 CSS)
const PADDING_LEFT_RPX = 24
const ITEM_WIDTH_RPX = 96
const ITEM_GAP_RPX = 16
const ITEM_STEP_RPX = ITEM_WIDTH_RPX + ITEM_GAP_RPX // 112rpx

/**
 * 记录实时滚动位置，用于 PREV 加载时的位置补偿
 */
function onScroll(e: any) {
  trackedScrollLeft.value = e.detail.scrollLeft
}

/**
 * 核心：纯数学计算目标 scroll-left 让选中项居中
 * 彻底避免抖音小程序 scroll-into-view 的原生层 DOM 延迟 Bug
 */
async function scrollToCenter() {
  const index = props.currentIndex
  if (index < 0 || index >= props.tabs.length)
    return

  // 计算当前 item 的中心点在整个 Scroll-View 中的绝对位置 (单位 rpx)
  // 公式: 左侧 Padding + 前面所有项的宽度 + 当前项宽度的一半
  const itemCenterRpx = PADDING_LEFT_RPX + (index * ITEM_STEP_RPX) + (ITEM_WIDTH_RPX / 2)
  const itemCenterPx = uni.upx2px(itemCenterRpx)

  // 目标 scroll-left = 元素中心位置 - 屏幕宽度的一半
  let targetScrollLeft = itemCenterPx - (screenWidthPx / 2)

  // 确保不能为负数
  targetScrollLeft = Math.max(0, targetScrollLeft)

  // 开启滚动动画，并确保 Vue 响应式生效后更新位置
  scrollWithAnimation.value = true
  await nextTick()
  scrollLeftValue.value = targetScrollLeft

  // 等待滚动动画完成，供父组件 await 后再解除切换锁
  await new Promise(resolve => setTimeout(resolve, 320))
}

/**
 * PREV 加载完成后同步补偿 scroll-left，避免页面跳动
 */
function adjustForPrepend(count: number) {
  // 标记抑制：PREV 加载会使 currentIndex += count，不应触发自动居中
  suppressNextAutoScroll = true
  // 必须关闭动画，做到瞬间移动补偿
  scrollWithAnimation.value = false
  const insertedWidthPx = uni.upx2px(count * ITEM_STEP_RPX)
  scrollLeftValue.value = trackedScrollLeft.value + insertedWidthPx

  // 补偿后，将 tracked 位置也同步更新，防止下次触发计算误差
  trackedScrollLeft.value = scrollLeftValue.value
}

defineExpose({ scrollToCenter, adjustForPrepend })

// 初始化：tabs 首次有数据后滚动到选中项
let initialized = false
watch(
  () => props.tabs.length,
  (len) => {
    if (!initialized && len > 0) {
      initialized = true
      scrollToCenter()
    }
  },
  { immediate: true },
)

// 监听 currentIndex 变化，自动触发居中
watch(
  () => props.currentIndex,
  () => {
    if (!initialized)
      return
    // adjustForPrepend 会导致 currentIndex 偏移，此时不应自动居中
    if (suppressNextAutoScroll) {
      suppressNextAutoScroll = false
      return
    }
    scrollToCenter()
  },
)

// 监听状态变化，重置触底/触顶标记
watch(() => props.hasPrev, (val) => {
  if (val)
    hasTriggeredPrevLoad.value = false
})
watch(() => props.hasNext, (val) => {
  if (val)
    hasTriggeredNextLoad.value = false
})
watch(() => props.loadCompleteKey, () => {
  if (props.hasPrev)
    hasTriggeredPrevLoad.value = false
  if (props.hasNext)
    hasTriggeredNextLoad.value = false
})

function onScrolltoupper() {
  if (props.hasPrev && !hasTriggeredPrevLoad.value) {
    hasTriggeredPrevLoad.value = true
    emit('load-more', 'PREV')
  }
}

function onScrolltolower() {
  if (props.hasNext && !hasTriggeredNextLoad.value) {
    hasTriggeredNextLoad.value = true
    emit('load-more', 'NEXT')
  }
}

function onTabClick(index: number) {
  if (props.switchLocked || props.currentIndex === index)
    return
  emit('change', index)
}
</script>

<template>
  <view
    class="absolute left-0 right-0 z-60"
    :style="{ bottom: 'calc(env(safe-area-inset-bottom) + 88rpx)' }"
  >
    <scroll-view
      class="w-full"
      scroll-x
      :show-scrollbar="false"
      :scroll-with-animation="scrollWithAnimation"
      :scroll-left="scrollLeftValue"
      @scroll="onScroll"
      @scrolltoupper="onScrolltoupper"
      @scrolltolower="onScrolltolower"
    >
      <view class="flex items-center gap-16rpx px-24rpx">
        <view
          v-for="(tab, index) in tabs"
          :key="tab.id"
          style="box-sizing: border-box"
          class="relative h-96rpx w-96rpx flex shrink-0 flex-col items-center gap-8rpx overflow-hidden border-4rpx rounded-lg border-solid transition-colors duration-200"
          :class="currentIndex === index ? 'border-color-white' : 'border-color-transparent'"
          @tap="onTabClick(index)"
        >
          <ImagePlaceholder
            :src="tab.thumbUrl"
            mode="aspectFill"
            class="h-full w-full"
            class-name="h-full w-full object-cover"
          />
          <view v-show="currentIndex !== index" class="absolute inset-0 bg-black/50 transition-opacity duration-200" />
          <view v-show="currentIndex === index" class="absolute h-4rpx w-40rpx rounded-full bg-primary -bottom-8rpx" />
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped lang="scss">
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
