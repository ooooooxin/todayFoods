<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useUserStore } from '@/store/user'
import { debounce } from '@/utils/debounce'

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'follow'): void
  (e: 'like'): void
  (e: 'favorite'): void
  (e: 'download'): void
}>()

/** 右侧操作点击防抖（仅首次立即执行，冷却内忽略重复点击） */
const TAP_DEBOUNCE_MS = 300

interface Author {
  id: number
  name: string
  avatar: string
  isFollowed: boolean
}

interface Stats {
  likeCount: number
  likeCountFormatted: string
  favoriteCount: number
  favoriteCountFormatted: string
  shareCount: number
  shareCountFormatted: string
  downloadCount: number
  downloadCountFormatted: string
}

interface Props {
  author: Author
  stats: Stats
  liked?: boolean
  favorited?: boolean
}

const userStore = useUserStore()

// 判断页面栈中是否存在创作者详情页
const hasCreatorDetailInStack = computed(() => {
  const pages = getCurrentPages()
  return pages.some(page => page.route?.includes('creatorDetails'))
})

// 判断是否是自己（作者id等于当前登录用户id）
const isSelf = computed(() => {
  return props.author.id === userStore.userInfo.id
})

const avatarLoadFailed = ref(false)
watch(() => props.author?.avatar, () => {
  avatarLoadFailed.value = false
})

function toCreatorDetail(id: number) {
  // 检查页面栈中是否已有创作者详情页
  const pages = getCurrentPages()
  const creatorDetailIndex = pages.findIndex(page => page.route?.includes('creatorDetails'))

  if (creatorDetailIndex !== -1) {
    // 页面栈中已有，返回该页面
    const delta = pages.length - 1 - creatorDetailIndex
    if (delta > 0) {
      uni.navigateBack({ delta })
    }
  }
  else {
    // 页面栈中没有，跳转过去
    uni.navigateTo({
      url: `/pages/creatorDetails/index?id=${id}`,
    })
  }
}

const debouncedToCreatorDetail = debounce(
  (id: number) => toCreatorDetail(id),
  TAP_DEBOUNCE_MS,
  { edges: ['leading'] },
)

const onFollow = debounce(() => emit('follow'), TAP_DEBOUNCE_MS, { edges: ['leading'] })
const onLike = debounce(() => emit('like'), TAP_DEBOUNCE_MS, { edges: ['leading'] })
const onFavorite = debounce(() => emit('favorite'), TAP_DEBOUNCE_MS, { edges: ['leading'] })
const onDownload = debounce(() => emit('download'), TAP_DEBOUNCE_MS, { edges: ['leading'] })
</script>

<template>
  <view class="absolute right-24rpx z-60 h-[720rpx] w-[120rpx] flex flex-col items-center justify-between rounded-24rpx bg-[rgba(0,0,0,0.6)] py-[24rpx]" :style="{ top: '50%', transform: 'translateY(-50%)' }">
    <!--  v-if="!hasCreatorDetailInStack" -->
    <view class="relative h-88rpx w-88rpx">
      <image
        class="box-border h-full w-full border-4rpx border-white rounded-full border-solid"
        :src="avatarLoadFailed ? '/static/images/default_picture.png' : author?.avatar"
        mode="aspectFill"
        @error="avatarLoadFailed = true"
        @tap="debouncedToCreatorDetail(author?.id)"
      />
      <!-- 关注按钮 - 不是自己且未关注时显示 -->
      <image
        v-if="!isSelf && !author.isFollowed"
        src="/static/images/ic_follow.png"
        mode="scaleToFill"
        class="absolute bottom-[-18rpx] h-40rpx w-40rpx"
        :style="{ left: '50%', transform: 'translateX(-50%)' }"
        @tap="onFollow"
      />
    </view>

    <!-- 点赞 -->
    <view class="flex flex-col items-center gap-4rpx" @tap="onLike">
      <image
        v-if="!liked"
        src="/static/images/ic_heaet_off.png"
        mode="scaleToFill"
        class="h-88rpx w-88rpx"
      />
      <image
        v-else
        src="/static/images/ic_heaet_on.png"
        mode="scaleToFill"
        class="h-88rpx w-88rpx"
      />
      <text class="text-24rpx text-white font-medium" style="text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.30);">{{ stats.likeCountFormatted }}</text>
    </view>

    <!-- 收藏 -->
    <view class="flex flex-col items-center gap-4rpx" @tap="onFavorite">
      <image
        v-if="!favorited"
        src="/static/images/ic_star_off.png"
        mode="scaleToFill"
        class="h-88rpx w-88rpx"
      />
      <image
        v-else
        src="/static/images/ic_star_on.png"
        mode="scaleToFill"
        class="h-88rpx w-88rpx"
      />
      <text class="text-24rpx text-white font-medium" style="text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.30);">{{ stats.favoriteCountFormatted }}</text>
    </view>

    <!-- 转发 -->
    <view class="relative flex flex-col items-center gap-4rpx">
      <image
        src="/static/images/ic_share.png"
        mode="scaleToFill"
        class="h-88rpx w-88rpx"
      />
      <!-- 透明分享按钮 - 覆盖在转发模块上 -->
      <button
        open-type="share"
        class="absolute inset-0 h-full w-full border-none bg-transparent opacity-0"
        style="padding: 0; margin: 0; border: none; background: transparent;"
      />
      <text class="text-24rpx text-white font-medium" style="text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.30);">{{ stats.shareCountFormatted }}</text>
    </view>

    <!-- 下载 -->
    <view class="flex flex-col items-center gap-4rpx" @tap="onDownload">
      <image
        src="/static/images/ic_download.png"
        mode="scaleToFill"
        class="h-88rpx w-88rpx"
      />
      <text class="text-24rpx text-white font-medium" style="text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.30);">{{ stats.downloadCountFormatted }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
/* 右侧交互面板样式 */
</style>
