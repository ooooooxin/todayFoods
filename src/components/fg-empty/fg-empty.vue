<script lang="ts" setup>
import { computed } from 'vue'

export type EmptyType = 'comment' | 'content' | 'date' | 'takedown' | 'load' | 'network' | 'update'

const props = withDefaults(defineProps<{
  text?: string
  iconSize?: string
  type?: EmptyType
  buttonText?: string
  showButton?: boolean
  fullHeight?: boolean
}>(), {
  text: undefined,
  iconSize: '300rpx',
  type: 'content',
  buttonText: '刷新',
  showButton: false,
  fullHeight: true,
})

const emit = defineEmits<{
  (e: 'button-click'): void
}>()

const iconSrc = computed(() => `/static/images/${props.type}.png`)

// 默认文本映射
const defaultTextMap: Record<EmptyType, string> = {
  comment: '还没有评论哦',
  content: '暂无内容',
  date: '暂无数据',
  takedown: '该内容已下架',
  load: '加载失败',
  network: '网络异常，请重试',
  update: '灵感升级中...',
}

// 显示文本：优先使用传入的text，否则使用type对应的默认文本
const displayText = computed(() => props.text ?? defaultTextMap[props.type])
</script>

<template>
  <view
    class="flex flex-col items-center justify-center"
    :class="fullHeight ? 'h-full flex-1' : 'py-120rpx'"
  >
    <image
      class="mb-24rpx"
      :style="{ width: iconSize, height: iconSize }"
      :src="iconSrc"
      mode="aspectFit"
    />
    <text class="text-28rpx text-main leading-[40rpx]">{{ displayText }}</text>
    <!-- 按钮 -->
    <view
      v-if="showButton"
      class="mt-32rpx h-64rpx flex items-center justify-center rounded-[32rpx] bg-primary px-52rpx"
      @click="emit('button-click')"
    >
      <text class="text-28rpx text-white font-bold">{{ buttonText }}</text>
    </view>
  </view>
</template>
