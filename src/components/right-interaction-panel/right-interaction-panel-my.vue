<script lang="ts" setup>
import { useUserStore } from '@/store/user'
import { debounce } from '@/utils/debounce'

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'topSwitch'): void
  (e: 'bottomSwitch'): void
  (e: 'remove'): void
}>()

const TAP_DEBOUNCE_MS = 300

const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)
interface Props {
  top: boolean
  source?: 'collectionAssets' | 'assets'
}

const onTopSwitch = debounce(() => emit('topSwitch'), TAP_DEBOUNCE_MS, { edges: ['leading'] })
const onBottomSwitch = debounce(() => emit('bottomSwitch'), TAP_DEBOUNCE_MS, { edges: ['leading'] })
const onRemove = debounce(() => emit('remove'), TAP_DEBOUNCE_MS, { edges: ['leading'] })
</script>

<template>
  <view class="absolute right-24rpx z-60 h-[444rpx] w-[120rpx] flex flex-col items-center justify-between rounded-24rpx bg-[rgba(0,0,0,0.6)] py-[24rpx]" :style="{ top: '50%', transform: 'translateY(-50%)' }">
    <!-- 置顶/取消置顶 -->
    <view class="flex flex-col items-center gap-8rpx" @tap="onTopSwitch">
      <image
        v-if="!top"
        src="/static/images/pin.png"
        mode="scaleToFill"
        class="h-88rpx w-88rpx"
      />
      <image
        v-else
        src="/static/images/unpin.png"
        mode="scaleToFill"
        class="h-88rpx w-88rpx"
      />
      <text class="text-24rpx text-white font-medium" style="text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.30);">{{ top ? '取消置顶' : '置顶' }}</text>
    </view>

    <!-- 置底 -->
    <view class="flex flex-col items-center gap-8rpx" @tap="onBottomSwitch">
      <image
        src="/static/images/to_bottom.png"
        mode="scaleToFill"
        class="h-88rpx w-88rpx"
      />
      <text class="text-24rpx text-white font-medium" style="text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.30);">置底</text>
    </view>

    <!-- 删除/移除 -->
    <view class="flex flex-col items-center gap-8rpx" @tap="onRemove">
      <image
        v-if="source === 'collectionAssets'"
        src="/static/images/remove.png"
        mode="scaleToFill"
        class="h-88rpx w-88rpx"
      />
      <image
        v-else
        src="/static/images/del.png"
        mode="scaleToFill"
        class="h-88rpx w-88rpx"
      />
      <text class="text-24rpx text-white font-medium" style="text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.30);">{{ (source === 'assets' || userInfo.level === 4) ? '删除' : '移除' }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
/* 右侧交互面板样式 */
</style>
