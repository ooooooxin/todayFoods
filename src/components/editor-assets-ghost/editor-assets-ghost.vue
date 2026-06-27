<script lang="ts" setup>
import type { CollectionAssetItem } from '@/api/ip/ip'
import type { MyAssetItem } from '@/api/me/me'
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  active: boolean
  item: CollectionAssetItem | MyAssetItem | null
  cellSize: number
  zone: 'pinned' | 'unpinned' | ''
  initX: number
  initY: number
}>()

const x = ref(props.initX || 0)
const y = ref(props.initY || 0)

watch(() => props.initX, (val) => x.value = val)
watch(() => props.initY, (val) => y.value = val)

function handleMove(data: { x: number, y: number }) {
  if (!props.active) return
  x.value = data.x
  y.value = data.y
}

onMounted(() => {
  uni.$on('emp-ghost-move', handleMove)
})

onUnmounted(() => {
  uni.$off('emp-ghost-move', handleMove)
})
</script>

<template>
  <view
    v-if="props.active && props.item" class="fixed z-[9999] rounded-[16rpx]"
    :style="{
      width: `${props.cellSize}px`,
      height: `${props.cellSize}px`,
      left: '0px',
      top: '0px',
      transform: `translate3d(${x}px, ${y}px, 0)`,
      opacity: 0.85,
      pointerEvents: 'none',
      willChange: 'transform',
      transition: 'transform 0.05s linear'
    }"
  >
    <view
      class="relative h-full w-full overflow-hidden rounded-[16rpx]"
      :style="{ border: '4rpx solid #333', transform: 'scale(1.08)', boxShadow: '0 12rpx 36rpx rgba(0,0,0,0.25)' }"
    >
      <image
        :src="props.item.staticThumbUrl || props.item.thumbUrl" mode="aspectFill"
        class="absolute left-0 top-0 h-full w-full rounded-[12rpx]"
      />
      <view v-if="props.zone === 'pinned'" class="absolute left-[16rpx] top-[16rpx]">
        <view
          class="mr-[8rpx] h-[36rpx] w-[72rpx] rounded-[18rpx] bg-[#477fff] text-center text-[20rpx] text-white font-bold line-height-[36rpx]"
        >
          置顶
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
</style>
