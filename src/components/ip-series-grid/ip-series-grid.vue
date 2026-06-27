<script lang="ts" setup>
import { ref, watch } from 'vue'
import { debounce } from '@/utils/debounce'

const props = defineProps<{
  list: IpSeriesGridItem[]
  isLoading: boolean
  hasMoreData: boolean
}>()

const emit = defineEmits<{
  (e: 'itemClick', id: string | number): void
}>()

const TAP_DEBOUNCE_MS = 300

export interface IpSeriesGridItem {
  id: string | number
  bannerImg: string
  bannerName: string
  hotValue: number | string
  hotValueStr: string
}

// u-waterfall 需要 v-model，会内部修改值，因此使用本地副本
const waterfallList = ref<IpSeriesGridItem[]>([])

watch(
  () => props.list,
  (newVal) => {
    waterfallList.value = newVal
    console.log(123, waterfallList.value)
  },
  { immediate: true },
)

function onItemClick(id: string | number) {
  emit('itemClick', id)
}

const debouncedOnItemClick = debounce(onItemClick, TAP_DEBOUNCE_MS, { edges: ['leading'] })
</script>

<template>
  <view class="relative mt-16rpx box-border">
    <u-waterfall v-model="waterfallList" :add-time="0" class="relative">
      <template #left="{ leftList }">
        <view
          v-for="item in leftList"
          :key="item.id"
          class="mb-[16rpx] overflow-hidden rounded-24rpx bg-white pa-[8rpx]"
          @click="debouncedOnItemClick(item.id)"
        >
          <ImagePlaceholder :src="item.bannerImg" mode="aspectFill" class="w-[336rpx]" class-name="w-[336rpx] h-[460rpx] rounded-16rpx" />
          <view class="px-[8rpx] pb-[8rpx] pt-[8rpx]">
            <view class="line-clamp-2 text-28rpx text-[#333] leading-[22px]">
              {{ item.bannerName }}
            </view>

            <view v-if="item.hotValue > 0" class="mt-[16rpx] inline-flex items-center border border-[rgba(102,102,102,0.1)] rounded-8rpx border-solid bg-[#F5F5F5] px-[12rpx] py-[4rpx]">
              <text class="text-20rpx text-[#999] leading-[18px]">人气值：{{ item.hotValueStr }}</text>
            </view>
          </view>
        </view>
      </template>

      <template #right="{ rightList }">
        <view
          v-for="item in rightList"
          :key="item.id"
          class="mb-[16rpx] overflow-hidden rounded-24rpx bg-white pa-[8rpx]"
          @click="debouncedOnItemClick(item.id)"
        >
          <ImagePlaceholder :src="item.bannerImg" mode="aspectFill" class="w-[336rpx]" class-name="w-[336rpx] h-[460rpx] rounded-16rpx" />
          <view class="px-[8rpx] pb-[8rpx] pt-[8rpx]">
            <view class="line-clamp-2 text-28rpx text-[#333] leading-[22px]">
              {{ item.bannerName }}
            </view>
            <view v-if="item.hotValue > 0" class="mt-[16rpx] inline-flex items-center border border-[rgba(102,102,102,0.1)] rounded-8rpx border-solid bg-[#F5F5F5] px-[12rpx] py-[4rpx]">
              <text class="text-20rpx text-[#999] leading-[18px]">人气值：{{ item.hotValueStr }}</text>
            </view>
          </view>
        </view>
      </template>
    </u-waterfall>
  </view>
  <!-- 加载状态 -->
  <view class="flex items-center justify-center py-[30rpx]">
    <text v-if="props.isLoading" class="text-24rpx text-[#999]">加载中...</text>
    <text v-else-if="!props.hasMoreData" class="text-24rpx text-[#999]">- 到底了 -</text>
  </view>
</template>

<style scoped>
/* 可根据需要补充样式 */
/* 覆盖 u-waterfall 样式，确保两列等宽且固定 */
:deep(.u-waterfall) {
  width: 720rpx !important; /* 352rpx * 2 + 16rpx gap */
  gap: 16rpx;
  margin: 0 auto;
}

:deep(.u-column) {
  flex: none !important;
  width: 352rpx !important;
}
</style>
