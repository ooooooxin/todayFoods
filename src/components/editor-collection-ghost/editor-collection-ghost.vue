<script lang="ts" setup>
/**
 * 合集拖拽幽灵层：位置由父组件 ref.setPosition 驱动，避免跟手时整表 setData
 */
import { ref, watch } from 'vue'

export interface GhostCollectionItem {
  id: string
  name: string
  count: number
  images: string[]
  shareCode?: string
}

const props = defineProps<{
  active: boolean
  item: GhostCollectionItem | null
  widthPx?: number
  cellHeightPx: number
  initX: number
  initY: number
  checkboxOn: boolean
}>()

const x = ref(props.initX || 0)
const y = ref(props.initY || 0)

watch(() => props.initX, val => x.value = val)
watch(() => props.initY, val => y.value = val)

function setPosition(nx: number, ny: number) {
  x.value = nx
  y.value = ny
}

defineExpose({ setPosition })
</script>

<template>
  <view
    v-if="props.active && props.item"
    class="pointer-events-none fixed z-[9999] box-border rounded-[16rpx] bg-white shadow-[0_4rpx_16rpx_0_rgba(0,0,0,0.05)]"
    :style="{
      width: '702rpx',
      minHeight: `${props.cellHeightPx}px`,
      left: '0px',
      top: '0px',
      transform: `translate3d(${x}px, ${y}px, 0)`,
      opacity: 0.92,
      willChange: 'transform',
      border: '4rpx solid #333',
    }"
  >
    <view class="relative z-2 box-border flex flex-col px-[24rpx] pb-[22rpx] pt-[28rpx]">
      <view class="flex items-center justify-between text-[32rpx] text-[#333] font-600">
        <view class="center">
          <text>{{ props.item.name || '合集名称' }}</text>
        </view>
        <view class="center">
          <text>({{ props.item.count || 0 }})</text>
          <view class="relative ml-10rpx h-36rpx w-36rpx">
            <image
              v-if="props.checkboxOn"
              src="/static/images/ic_checkbox_on.png"
              mode="scaleToFill"
              class="h-full w-full"
            />
            <image
              v-else
              src="/static/images/ic_checkbox_off.png"
              mode="scaleToFill"
              class="h-full w-full"
            />
          </view>
        </view>
      </view>
      <view class="my-[20rpx] flex items-center justify-between font-600">
        <view v-if="props.item.shareCode" class="inline-flex items-center border border-[rgba(102,102,102,0.1)] rounded-8rpx border-solid bg-[#F5F5F5] px-[12rpx] py-[4rpx]">
          <text class="text-20rpx text-[#999] leading-[18px]">口令：</text>
          <text class="ml-4rpx text-20rpx text-[#999] leading-[18px]">{{ props.item.shareCode }}</text>
        </view>
      </view>
      <view class="relative mt-auto h-[160rpx]">
        <view class="flex gap-[22rpx]">
          <!-- 幽灵层用原生 image，避免 ImagePlaceholder 额外逻辑加重 setData -->
          <image
            v-for="(img, idx) in props.item.images" :key="`g-${props.item.id}-${idx}`"
            :src="img" mode="aspectFill" :lazy-load="false"
            class="h-[160rpx] w-[160rpx] rounded-[16rpx]"
          />
        </view>
      </view>
    </view>
  </view>
</template>
