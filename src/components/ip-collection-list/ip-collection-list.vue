/**
* IP列表和合集列表通用组件 包含选择功能
*/

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUserStore } from '@/store/user'
import { debounce } from '@/utils/debounce'

const props = withDefaults(defineProps<{
  list: IpCollectionItem[]
  hasMore: boolean
  mode?: ModeType // ip 或 collection
  isSelf?: boolean // 是否是自己的合集，mode为collection时生效
  isEdit?: boolean // 是否进入编辑状态，mode为collection时生效
  showPassword?: boolean // 是否显示合集口令，mode为collection时生效
  userLevel?: number // 用户等级，优先使用此值，否则使用userInfo.level
}>(), {
  mode: 'ip',
})
// const emit = defineEmits<{
//   (event: 'toDetails', id: number): void
// }>()

const emit = defineEmits<{
  (event: 'handleClick', item: IpCollectionItem): void
  (event: 'editName', item: IpCollectionItem): void
}>()
const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)
const TAP_DEBOUNCE_MS = 300

interface IpCollectionItem {
  id: string
  name: string
  count: number
  countFormatted?: string
  bg: string
  mainImg?: string
  engageCount?: string
  popCount?: string
  images: string[]
  shareCode?: string
  selected?: boolean // 是否选中，编辑状态下使用
  avatarImgUrl?: string
  interactionScore?: string
}

type ModeType = 'ip' | 'collection'

const isCopying = ref(false)

const isCollection = computed(() => props.mode === 'collection')

// 优先使用传入的userLevel，否则使用userInfo.level
const currentUserLevel = computed(() => props.userLevel ?? userInfo.value.level)

const processedList = computed(() => {
  if (!props.list || !Array.isArray(props.list)) {
    return []
  }
  return props.list.map((item) => {
    const images = [...(item.images || [])]
    while (images.length < 4) {
      images.push('')
    }
    return { ...item, images }
  })
})

function handleClick(item: IpCollectionItem) {
  emit('handleClick', item)
}

function editName(item: IpCollectionItem) {
  emit('editName', item)
}

const debouncedHandleClick = debounce(handleClick, TAP_DEBOUNCE_MS, { edges: ['leading'] })
const debouncedEditName = debounce(editName, TAP_DEBOUNCE_MS, { edges: ['leading'] })

function copyPassword(password: string) {
  if (isCopying.value || !password)
    return

  isCopying.value = true

  uni.setClipboardData({
    data: password,
    success: () => {
      // 复制的toast必须用uni提供的，否则无法覆盖原生toast
      uni.showToast({ title: '口令已复制', icon: 'success' })
    },
    fail: (err) => {
      console.log('复制失败', err)
      // 复制的toast必须用uni提供的，否则无法覆盖原生toast
      uni.showToast({ title: '复制失败', icon: 'none' })
    },
    complete: () => {
      setTimeout(() => {
        isCopying.value = false
      }, 1000)
    },
  })
}
</script>

<template>
  <view class="box-border flex flex-col items-center gap-[12rpx] bg-[#f5f5f5] pb-[8rpx] pt-[16rpx]">
    <!-- :class="isCollection ? 'auto-h' : 'h-[320rpx]'" -->
    <view
      v-for="item in processedList" :key="item.id"
      class="auto-h relative w-[702rpx] overflow-hidden rounded-[32rpx] bg-white"
      @tap="debouncedHandleClick(item)"
    >
      <view class="relative z-2 box-border h-full flex flex-col px-[24rpx] pb-[22rpx] pt-[28rpx]">
        <view class="flex items-center">
          <image
            v-if="!isCollection || (isCollection && currentUserLevel === 4)"
            :src="item.avatarImgUrl || '/static/images/default_picture.png'"
            mode="scaleToFill"
            class="mr-[24rpx] h-[96rpx] w-[96rpx] rounded-full"
          />
          <view class="flex-1">
            <view class="flex items-center justify-between text-[32rpx] text-[#333] font-600">
              <view class="center">
                <text>{{ item.name }}</text>
                <view v-if="isCollection && props.isSelf && currentUserLevel !== 4" class="relative h-48rpx w-48rpx center" @tap.stop="debouncedEditName(item)">
                  <i class="iconfont icon-a-shuxingbianjizhuangtaioff absolute center" />
                </view>
              </view>
              <view class="center">
                <text>{{ item.countFormatted }}</text>
                <!-- 编辑状态下的选中/未选中样式 -->
                <view v-if="isCollection && isEdit" class="relative ml-10rpx h-36rpx w-36rpx">
                  <!-- 选中状态 -->
                  <image
                    v-if="item.selected" src="/static/images/ic_checkbox_on.png" mode="scaleToFill"
                    class="h-full w-full"
                  />
                  <!-- 未选中状态 -->
                  <image v-else src="/static/images/ic_checkbox_off.png" mode="scaleToFill" class="h-full w-full" />
                </view>
              </view>
            </view>
            <view class="mt-[20rpx] flex items-center">
              <!-- 非合集或合集且为官方帐号时显示互动量 -->
              <view v-if="(!isCollection || currentUserLevel === 4) && item.popCount && item.popCount !== '0'" class="mr-16rpx inline-flex items-center border border-[rgba(102,102,102,0.1)] rounded-8rpx border-solid bg-[#F5F5F5] px-[12rpx] py-[4rpx]">
                <text class="text-20rpx text-[#999] leading-[18px]">人气值</text>
                <text class="ml-4rpx text-20rpx text-[#999] leading-[18px]">{{ item.popCount || '0' }}</text>
              </view>
              <!-- 合集时显示口令 -->
              <view v-if="isCollection && showPassword" class="inline-flex items-center border border-[rgba(102,102,102,0.1)] rounded-8rpx border-solid bg-[#F5F5F5] px-[12rpx] py-[4rpx]">
                <text class="text-20rpx text-[#999] leading-[18px]">口令：</text>
                <text class="ml-4rpx text-20rpx text-[#999] leading-[18px]">{{ item.shareCode }}</text>
                <text class="ml-8rpx text-20rpx text-[#333] leading-[18px]" @tap.stop="copyPassword(item.shareCode)">复制</text>
              </view>
            </view>
          </view>
        </view>
        <view class="relative mt-20rpx h-[150rpx]">
          <view class="flex gap-[20rpx]">
            <ImagePlaceholder
              v-for="(img, idx) in item.images" :key="`${item.id}-${idx}`" :src="img"
              mode="aspectFill" lazy-load webp class-name="h-[150rpx] w-[150rpx] rounded-[16rpx]"
            />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.auto-h {
  height: auto;
  min-height: 200rpx;
}
</style>
