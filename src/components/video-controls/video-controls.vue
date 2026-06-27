<script lang="ts" setup>
import { computed, ref } from 'vue'

interface Props {
  isPlaying: boolean
  currentTime: number
  duration: number
  buffered: number
  volume: number
  isMuted: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'playPause'): void
  (e: 'seek', time: number): void
  (e: 'volumeChange', volume: number): void
  (e: 'toggleMute'): void
}>()

// 是否正在拖拽
const isDragging = ref(false)
// 拖拽时的临时进度
const dragPercent = ref(0)
// 进度条 ref
const progressBarRef = ref<HTMLElement | null>(null)

// 播放进度百分比
const playedPercent = computed(() => {
  if (isDragging.value)
    return dragPercent.value
  return props.duration > 0 ? (props.currentTime / props.duration) * 100 : 0
})

// 缓冲进度百分比
const bufferedPercent = computed(() => {
  return props.duration > 0 ? (props.buffered / props.duration) * 100 : 0
})

// 格式化时间显示
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 更新进度
function updateProgress(clientX: number) {
  if (!progressBarRef.value)
    return
  const rect = progressBarRef.value.getBoundingClientRect()
  const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
  dragPercent.value = percent
}

// 处理进度条触摸开始
function onTouchStart(e: TouchEvent) {
  isDragging.value = true
  updateProgress(e.touches[0].clientX)
}

// 处理进度条触摸移动
function onTouchMove(e: TouchEvent) {
  if (!isDragging.value)
    return
  updateProgress(e.touches[0].clientX)
}

// 处理进度条触摸结束
function onTouchEnd() {
  if (!isDragging.value)
    return
  isDragging.value = false
  const time = (dragPercent.value / 100) * props.duration
  emit('seek', time)
}

// 处理音量调节
function onVolumeChange(e: Event) {
  const value = Number.parseFloat((e.target as HTMLInputElement).value)
  emit('volumeChange', value)
}
</script>

<template>
  <view class="absolute bottom-210rpx left-0 right-0 z-20 px-24rpx">
    <!-- 进度条区域 -->
    <view class="mb-16rpx flex items-center gap-16rpx">
      <!-- 进度条 -->
      <view
        ref="progressBarRef" class="progress-bar relative h-8rpx flex-1 rounded-full bg-white/30"
        @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd"
      >
        <!-- 缓冲进度 -->
        <view class="absolute left-0 top-0 h-full rounded-full bg-white/50" :style="{ width: `${bufferedPercent}%` }" />
        <!-- 播放进度 -->
        <view class="absolute left-0 top-0 h-full rounded-full bg-primary" :style="{ width: `${playedPercent}%` }" />
        <!-- 拖拽圆点 -->
        <view
          class="absolute h-24rpx w-24rpx rounded-full bg-primary shadow-lg"
          :style="{ left: `calc(${playedPercent}% - 12rpx)`, top: '50%', transform: 'translateY(-50%)' }"
        />
      </view>

      <!-- 时间显示 -->
      <text class="w-120rpx text-center text-22rpx text-white font-medium">
        {{ formatTime(currentTime) }}/{{ formatTime(duration) }}
      </text>

      <!-- 音量控制 -->
      <view class="relative flex items-center">
        <view class="h-48rpx w-48rpx flex items-center justify-center bg-white" @tap="emit('toggleMute')">
          <text v-if="isMuted || volume === 0" class="iconfont icon-volume-off text-32rpx text-white" />
          <text v-else class="iconfont icon-volume-on text-32rpx text-white" />
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
/* 视频控制组件样式 */
</style>
