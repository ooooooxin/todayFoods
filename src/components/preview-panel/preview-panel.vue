<script lang="ts" setup>
import { computed, ref, watch } from 'vue'

interface Props {
  mediaUrl: string
  mediaType: 'video' | 'image'
  label?: string
  labelTop?: number
  type?: 'preview' | 'works'
  showWatermark?: boolean
  tempUrl?: string
  // 错误状态相关
  hasError?: boolean
  errorCode?: number | null
  errorMsg?: string
  /** 为 true 时不向父组件派发 touchStart/touchMove/touchEnd，禁止开始新的滑动手势（上一段切换未完成） */
  switchLocked?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: '原创',
  labelTop: 15,
  type: 'works',
  showWatermark: false,
  tempUrl: '',
  hasError: false,
  errorCode: null,
  errorMsg: '',
  switchLocked: false,
})

const emit = defineEmits<{
  // (e: 'mediaError', error: any): void
  (e: 'toggleMute', isMuted: boolean): void
  (e: 'touchStart', event: TouchEvent): void
  (e: 'touchMove', event: TouchEvent): void
  (e: 'touchEnd', event: TouchEvent): void
  (e: 'imageLoad'): void
  (e: 'videoPlay'): void
  (e: 'videoReady'): void
  (e: 'videoMetadata', payload: { duration: number }): void
  (e: 'videoTimeUpdate', payload: { currentTime: number, duration: number }): void
  (e: 'refresh'): void
}>()

// 静音状态，默认静音
const isMuted = ref(true)

const mediaError = ref(false)

// 视频元数据是否已加载完成，用于控制初始显示避免高度闪烁
const isVideoReady = ref(false)

// 监听 mediaUrl 变化时重置错误状态
watch(() => props.mediaUrl, () => {
  mediaError.value = false
  isVideoReady.value = false
})

/**
 * 切换素材时父级可能先清空详情导致 mediaUrl 为空，但会用 tempUrl 显示缩略图；此期间不应闪占位。
 * 当 tempUrl 存在时，不显示占位图（让缩略图兜底）
 */
const showMediaPlaceholder = computed(() => (mediaError.value || !props.mediaUrl) && !props.tempUrl)

// 切换静音
function toggleMute() {
  isMuted.value = !isMuted.value
  emit('toggleMute', isMuted.value)
}

// function onVideoError(e: any) {
//   emit('mediaError', e)
// }

// function onImageError(e: any) {
//   emit('mediaError', e)
// }

// 媒体加载错误处理
function onMediaError(e: any) {
  console.log('[PreviewPanel] 媒体加载错误', e)
  mediaError.value = true
}

// 图片加载完成
function onImageLoad() {
  emit('imageLoad')
}

// 视频开始播放 - 此时视频已实际渲染，可以安全清除缩略图
function onVideoPlay() {
  emit('imageLoad')
  emit('videoPlay')
}

// 视频元数据加载完成 - 可以开始播放
function onVideoMetadataLoaded(e: { detail?: { duration?: number } }) {
  isVideoReady.value = true
  const duration = e?.detail?.duration ?? 0
  emit('videoReady')
  emit('videoMetadata', { duration })
}

function onVideoTimeUpdate(e: { detail?: { currentTime?: number, duration?: number } }) {
  emit('videoTimeUpdate', {
    currentTime: e?.detail?.currentTime ?? 0,
    duration: e?.detail?.duration ?? 0,
  })
}
// 触摸事件处理 - 添加滑动检测
const touchState = ref({
  startX: 0,
  startY: 0,
  isMoving: false,
})

/** 本次手指按下后是否已向父组件派发过 touchStart（与 switchLocked 配合，避免切换未完成时又起新手势） */
const gestureTracked = ref(false)

// 切换锁生效时打断未结束的手势，避免父页面仍累积 move / 在松手时误触发切换
watch(
  () => props.switchLocked,
  (locked) => {
    if (!locked || !gestureTracked.value)
      return
    gestureTracked.value = false
    touchState.value.isMoving = false
    emit('touchEnd', {} as TouchEvent)
  },
)

function handleTouchStart(e: TouchEvent) {
  if (props.switchLocked)
    return
  gestureTracked.value = true
  const touch = e.touches[0]
  touchState.value.startX = touch.clientX
  touchState.value.startY = touch.clientY
  touchState.value.isMoving = false
  emit('touchStart', e)
}

function handleTouchMove(e: TouchEvent) {
  if (!gestureTracked.value)
    return
  const touch = e.touches[0]
  const deltaX = Math.abs(touch.clientX - touchState.value.startX)
  const deltaY = Math.abs(touch.clientY - touchState.value.startY)
  // 如果移动距离超过 10px，认为是滑动
  if (deltaX > 10 || deltaY > 10) {
    touchState.value.isMoving = true
  }
  emit('touchMove', e)
}

function handleTouchEnd(e: TouchEvent) {
  if (gestureTracked.value) {
    gestureTracked.value = false
    emit('touchEnd', e)
  }
  // 重置状态
  touchState.value.isMoving = false
}

function handleTouchCancel(e: TouchEvent) {
  if (gestureTracked.value) {
    gestureTracked.value = false
    emit('touchEnd', e)
  }
  touchState.value.isMoving = false
}

// 刷新按钮点击
function handleRefresh() {
  emit('refresh')
}
</script>

<template>
  <view class="relative h-full w-full overflow-hidden">
    <!-- 错误状态页面 - 使用 v-if 在 hasError 变化时重新创建组件 -->
    <view
      v-if="hasError"
      class="absolute left-0 top-0 z-50 h-full w-full flex flex-col items-center justify-center bg-[#181818]"
    >
      <image
        class="mb-48rpx opacity-50"
        src="/static/images/watermark.png"
        mode="aspectFit"
        :style="{ width: '592rpx', height: '314rpx' }"
      />
      <!-- 错误提示文字 -->
      <text class="text-28rpx text-[#999] leading-[40rpx]">
        {{ errorMsg }}
      </text>
      <!-- 刷新按钮（非4100错误时显示） -->
      <view
        v-if="errorCode !== 4100"
        class="relative z-[60] mt-32rpx h-64rpx flex items-center justify-center rounded-[32rpx] bg-[#fff] px-52rpx"
        @click="handleRefresh"
      >
        <text class="text-28rpx text-[#333] font-bold">刷新</text>
      </view>
      <!-- 错误状态触摸事件层：在刷新按钮下方 -->
      <view
        class="absolute left-0 top-0 z-[55] h-full w-full"
        @touchstart.stop="handleTouchStart"
        @touchmove.stop="handleTouchMove"
        @touchend.stop="handleTouchEnd"
        @touchcancel.stop="handleTouchCancel"
      />
    </view>

    <!-- 媒体内容 - 使用 v-if 在 hasError 变化时重新创建组件，确保 @error 事件能正常触发 -->
    <view v-if="!hasError" class="h-full w-full center">
      <template v-if="mediaType === 'video'">
        <!-- 视频底层缩略图兜底：低端机视频解码慢时显示缩略图，避免黑屏 -->
        <!-- <image
          v-if="tempUrl && !mediaError"
          class="absolute inset-0 z-2 h-full w-full"
          :src="tempUrl"
          mode="aspectFit"
        /> -->
        <video
          v-if="mediaUrl && !mediaError"
          :id="`video-${mediaUrl}`"
          :key="mediaUrl"
          class="relative z-1 h-full w-full transition-opacity duration-300"
          :class="{ 'opacity-0': !isVideoReady }"
          :src="mediaUrl"
          controls
          :show-play-btn="false"
          :show-fullscreen-btn="false"
          :enable-progress-gesture="false"
          object-fit="contain"
          loop
          autoplay
          :muted="isMuted"
          direction="horizontal"
          @error="onMediaError"
          @play="onVideoPlay"
          @loadedmetadata="onVideoMetadataLoaded"
          @timeupdate="onVideoTimeUpdate"
        />
        <!-- 视频出错但有缩略图时不显示占位图，让缩略图兜底 -->
        <ImagePlaceholder v-if="showMediaPlaceholder" placeholder-only mode="widthFix" class-name="h-750rpx w-750rpx object-cover z-3" />
        <!-- 透明遮罩层：捕获滑动事件，防止视频拦截 -->
        <view
          class="absolute inset-0 z-5"
          @touchstart.stop="handleTouchStart"
          @touchmove.stop="handleTouchMove"
          @touchend.stop="handleTouchEnd"
          @touchcancel.stop="handleTouchCancel"
        />
      </template>
      <template v-else>
        <!-- 临时预览图（缩略图）：在高清图 @load 之前持续显示 -->
        <image
          v-if="tempUrl && !mediaError"
          class="absolute inset-0 z-2 h-full w-full"
          :src="tempUrl"
          mode="aspectFit"
        />
        <!--
          高清图使用 widthFix：宽度随容器，高度按原图比例。
          勿使用 h-full/object-cover，否则解码前易被父级拉满高度，出现「先纵向拉伸再恢复」的闪动（矮图更明显）。
        -->
        <image
          v-if="mediaUrl && !mediaError"
          :key="mediaUrl"
          class="h-full w-full"
          :src="mediaUrl"
          mode="aspectFit"
          @load="onImageLoad"
          @error="onMediaError"
        />
        <ImagePlaceholder v-if="showMediaPlaceholder" placeholder-only mode="widthFix" class-name="h-750rpx w-750rpx object-cover z-3" />
        <!-- 图片触摸事件层 -->
        <view
          class="absolute inset-0 z-5"
          @touchstart.stop="handleTouchStart"
          @touchmove.stop="handleTouchMove"
          @touchend.stop="handleTouchEnd"
          @touchcancel.stop="handleTouchCancel"
        />
      </template>
    </view>

    <!-- 右下角标签 -->
    <view
      v-if="label"
      class="absolute z-10 h-[44rpx] w-[64rpx] center rounded-[8rpx]"
      :class="type === 'preview'
        ? 'bg-tip'
        : { 'bg-[#FFDE3B]': label === '原创', 'bg-[#F96705]': label === '二创' }"
      :style="{
        right: '32rpx',
        bottom: 'calc(env(safe-area-inset-bottom) + 88rpx + 80rpx + 104rpx)',
      }"
    >
      <text
        class="text-20rpx font-bold"
        :class="type === 'preview' || label === '二创' ? 'text-white' : 'text-black'"
      >
        {{ label }}
      </text>
    </view>

    <!-- 左侧静音按钮 -->
    <view
      v-if="mediaType === 'video'"
      class="absolute z-20 center cursor-pointer rounded-full bg-[rgba(0,0,0,0.5)]"
      :style="{
        left: '30rpx',
        bottom: 'calc(env(safe-area-inset-bottom) + 88rpx + 80rpx + 104rpx)',
        width: '60rpx',
        height: '60rpx',
      }"
      @tap.stop="toggleMute"
    >
      <image
        v-if="!isMuted"
        src="/static/images/ic_sound_on.png"
        mode="scaleToFill"
        class="h-40rpx w-40rpx"
      />
      <image
        v-else
        src="/static/images/ic_sound_off.png"
        mode="scaleToFill"
        class="h-40rpx w-40rpx"
      />
    </view>

    <!-- 水印图片 - 视频出错但有缩略图兜底时仍显示水印 -->
    <image
      v-if="showWatermark && !hasError && (!mediaError || tempUrl)"
      class="absolute left-1/2 top-1/2 z-1 opacity-50 -translate-x-1/2 -translate-y-1/2"
      src="/static/images/watermark.png"
      mode="aspectFit"
      :style="{ width: '592rpx', height: '314rpx' }"
    />
  </view>
</template>

<style scoped lang="scss">
/* 媒体内容样式 */
</style>
