<script lang="ts" setup>
import { computed } from 'vue'
import { debounce } from '@/utils/debounce'

export interface IpSeriesGridWaterfallItem {
  id: string | number
  bannerImg: string
  bannerName: string
  hotValue: number | string
  hotValueStr: string
}

interface WaterfallColumn {
  list: IpSeriesGridWaterfallItem[]
  height: number
}

const props = defineProps<{
  list: IpSeriesGridWaterfallItem[]
}>()

const emit = defineEmits<{
  (e: 'itemClick', id: string | number): void
}>()

const TAP_DEBOUNCE_MS = 300
const BASE_CARD_HEIGHT = 508
const TITLE_LINE_HEIGHT = 44
const HOT_VALUE_HEIGHT = 60
const TITLE_LINE_CHAR_LIMIT = 11

function hasHotValue(item: IpSeriesGridWaterfallItem) {
  return Number(item.hotValue) > 0
}

function getTitleWeight(title: string) {
  return Array.from(title || '').reduce((total, char) => {
    return total + (char.charCodeAt(0) <= 0x7F ? 0.5 : 1)
  }, 0)
}

function getTitleLineCount(item: IpSeriesGridWaterfallItem) {
  return getTitleWeight(item.bannerName) > TITLE_LINE_CHAR_LIMIT ? 2 : 1
}

function getItemHeight(item: IpSeriesGridWaterfallItem) {
  return BASE_CARD_HEIGHT + getTitleLineCount(item) * TITLE_LINE_HEIGHT + (hasHotValue(item) ? HOT_VALUE_HEIGHT : 0)
}

const columns = computed(() => {
  const left: WaterfallColumn = { list: [], height: 0 }
  const right: WaterfallColumn = { list: [], height: 0 }

  props.list.forEach((item) => {
    const targetColumn = left.height <= right.height ? left : right
    targetColumn.list.push(item)
    targetColumn.height += getItemHeight(item)
  })

  return {
    leftList: left.list,
    rightList: right.list,
  }
})

function onItemClick(id: string | number) {
  emit('itemClick', id)
}

const debouncedOnItemClick = debounce(onItemClick, TAP_DEBOUNCE_MS, { edges: ['leading'] })
</script>

<template>
  <view class="relative mx-auto w-[720rpx] flex items-start gap-[16rpx]">
    <view class="w-[352rpx] shrink-0">
      <view
        v-for="item in columns.leftList"
        :key="item.id"
        class="mb-[16rpx] overflow-hidden rounded-24rpx bg-white pa-[8rpx]"
        @click="debouncedOnItemClick(item.id)"
      >
        <view class="h-[460rpx] w-[336rpx] overflow-hidden rounded-16rpx">
          <ImagePlaceholder :src="item.bannerImg" mode="aspectFill" class-name="h-full w-full" />
        </view>
        <view class="px-[8rpx] pb-[16rpx] pt-[8rpx]">
          <view class="line-clamp-2 text-28rpx text-[#333] leading-[22px]">
            {{ item.bannerName }}
          </view>

          <view v-if="hasHotValue(item)" class="mt-[16rpx] inline-flex items-center border border-[rgba(102,102,102,0.1)] rounded-8rpx border-solid bg-[#F5F5F5] px-[12rpx] py-[4rpx]">
            <text class="text-20rpx text-[#999] leading-[18px]">人气值：{{ item.hotValueStr }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="w-[352rpx] shrink-0">
      <view
        v-for="item in columns.rightList"
        :key="item.id"
        class="mb-[16rpx] overflow-hidden rounded-24rpx bg-white pa-[8rpx]"
        @click="debouncedOnItemClick(item.id)"
      >
        <view class="h-[460rpx] w-[336rpx] overflow-hidden rounded-16rpx">
          <ImagePlaceholder :src="item.bannerImg" mode="aspectFill" class-name="h-full w-full" />
        </view>
        <view class="px-[8rpx] pb-[16rpx] pt-[8rpx]">
          <view class="line-clamp-2 text-28rpx text-[#333] leading-[22px]">
            {{ item.bannerName }}
          </view>
          <view v-if="hasHotValue(item)" class="mt-[16rpx] inline-flex items-center border border-[rgba(102,102,102,0.1)] rounded-8rpx border-solid bg-[#F5F5F5] px-[12rpx] py-[4rpx]">
            <text class="text-20rpx text-[#999] leading-[18px]">人气值：{{ item.hotValueStr }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>
