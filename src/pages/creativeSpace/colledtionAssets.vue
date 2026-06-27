<script lang="ts" setup>
import type { CollectionAssetItem } from '@/api/ip/ip'
import { onLoad, onPageScroll, onReachBottom, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, reactive, ref, watch } from 'vue'
import { getCollectionAssets } from '@/api/ip/ip'
import { usePageScrollBridge } from '@/hooks/usePageScrollBridge'
import { usePageScrollStore } from '@/store/pageScroll'
import { usePreviewDetailsStore } from '@/store/previewDetails'
import { useUserStore } from '@/store/user'
import { statusNavTotalHeight } from '@/utils/systemInfo'

const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)
const previewDetailsStore = usePreviewDetailsStore()
const pageScrollStore = usePageScrollStore()

usePageScrollBridge()

const customToTopBottom = ref('')

definePage({
  style: {
    navigationBarTitleText: '合集素材',
  },
})

// 页面参数
const collectionId = ref<string>()
const collectionName = ref('合集名称')
const fromMe = ref(false)
const total = ref()

// 在 onLoad 中获取页面参数并加载数据
onLoad((options) => {
  collectionId.value = options?.id || undefined
  collectionName.value = options?.name || '合集名称'
  fromMe.value = options?.fromMe === '1'
  // 初始加载数据
  fetchAssetList(true)

  // 监听素材更新事件
  uni.$on('collectionAssetsUpdated', (data: { collectionId: string }) => {
    if (data.collectionId === collectionId.value) {
      fetchAssetList(true)
    }
  })
})

// 页面卸载时取消监听，并通知首页刷新
onUnload(() => {
  uni.$off('collectionAssetsUpdated')
  // 通知首页刷新合集列表
  uni.$emit('collectionListNeedRefresh')
})

// 瀑布流数据（合集素材）
const waterfallData = ref<CollectionAssetItem[]>([])

// 分页状态（游标分页）
const pageState = reactive({
  nextCursorId: undefined as string | undefined,
  nextCursorIsTop: undefined as number | undefined,
  nextCursorSort: undefined as number | undefined,
  hasNext: true,
  loading: false,
})
// 瀑布流图片是否全部加载完成
const isWaterfallImagesLoaded = ref(false)

// 底部操作栏高度：h-[60rpx] + pb-40rpx + pt-20rpx = 120rpx
// 有底部操作栏时 ToTop bottom = 72rpx + 120rpx = 192rpx
// 底部操作栏在 !fromMe 时显示
watch(
  () => fromMe.value,
  (isFromMe) => {
    if (!isFromMe) {
      customToTopBottom.value = '192rpx'
      pageScrollStore.setToTopBottom('192rpx')
    }
    else {
      customToTopBottom.value = ''
      pageScrollStore.setToTopBottom('')
    }
  },
  { immediate: true },
)

onShow(() => {
  pageScrollStore.setToTopBottom(customToTopBottom.value)
  setTimeout(() => {
    if (uni.getStorageSync('needRefreshFromException') === '1') {
      uni.removeStorageSync('needRefreshFromException')
      fetchAssetList(true)
    }
  }, 100)
})

// 获取素材列表
async function fetchAssetList(isRefresh = false) {
  if (pageState.loading || (!pageState.hasNext && !isRefresh))
    return
  pageState.loading = true

  if (isRefresh) {
    pageState.nextCursorId = undefined
    pageState.nextCursorIsTop = undefined
    pageState.nextCursorSort = undefined
    pageState.hasNext = true
  }
  // 重置图片加载状态
  isWaterfallImagesLoaded.value = false

  try {
    const res = await getCollectionAssets({
      collectionId: collectionId.value!,
      cursorId: pageState.nextCursorId,
      cursorIsTop: pageState.nextCursorIsTop,
      cursorSort: pageState.nextCursorSort,
      pageSize: 20,
    })
    if (isRefresh) {
      waterfallData.value = res.records
    }
    else {
      waterfallData.value.push(...res.records)
    }

    pageState.nextCursorId = res.nextCursorId ?? undefined
    pageState.nextCursorIsTop = res.nextCursorIsTop ?? undefined
    pageState.nextCursorSort = res.nextCursorSort ?? undefined
    pageState.hasNext = res.hasNext
    total.value = res.total || res.assetCountFormatted || 0
  }
  catch (error) {
    console.error('获取素材列表失败', error)
  }
  finally {
    pageState.loading = false
  }
}

// 处理素材点击
function handleItemClick(item: CollectionAssetItem, index: number) {
  // 存储页面状态到store
  previewDetailsStore.setEntrySource('collectionAssets')
  previewDetailsStore.setApiParams({
    collectionAssets: {
      collectionId: collectionId.value!,
    },
  })
  previewDetailsStore.setCurrentItem(item, index)

  // 跳转到作品详情页，传递当前合集名称作为页面标题
  uni.navigateTo({
    url: `/pages/creativeSpace/previewDetails?id=${item.id}&source=collectionAssets&title=${encodeURIComponent(collectionName.value)}`,
  })
}

// 处理素材失效，刷新列表
function handleAssetInvalid() {
  fetchAssetList(true)
}

// 添加素材
function handleAddAssets() {
  uni.navigateTo({
    url: `/pages/creativeSpace/addAssetsToCollection?collectionId=${collectionId.value}`,
  })
}

// 跳转到编辑页面
function toEditPage() {
  uni.navigateTo({
    url: `/pages/creativeSpace/editCollectionAssets?id=${collectionId.value}&name=${collectionName.value}`,
  })
}

// 页面触底事件，加载更多素材
onReachBottom(() => {
  fetchAssetList()
})

onPageScroll((e) => {

})
</script>

<template>
  <view class="h-screen flex flex-col">
    <!-- 头部占位 -->
    <CommonHeader mode="fixed" :scroll-top="0" bg-color="#ffffff" />
    <!-- 页面标题 -->
    <custom-title
      :text="collectionName"
      :count="total ?? 0"
      text-color="text-main"
    />

    <view class="pointer-events-none fixed left-0 w-full" :style="{ top: `${statusNavTotalHeight}px` }" style="height: 80rpx; background: linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0));" />

    <!-- 有数据时显示瀑布流列表 -->
    <view
      v-if="waterfallData.length > 0"
      class="box-border flex-1 pt-24rpx"
      :style="{ paddingTop: `${statusNavTotalHeight + 8}px` }"
      :class="fromMe ? 'pb-safe' : 'pb-180rpx'"
    >
      <FgWaterfall
        :list="waterfallData"
        :has-top-label="true"
        :has-type-label="true"
        :has-bottom-info="true"
        scene="2"
        @item-click="handleItemClick"
        @asset-invalid="handleAssetInvalid"
        @all-images-loaded="isWaterfallImagesLoaded = true"
      />
      <!-- 底部提示：有数据、没有下一页、且图片全部加载完成时显示 -->
      <view v-if="!pageState.hasNext && !pageState.loading && isWaterfallImagesLoaded" class="py-40rpx text-center text-24rpx text-gray-400">
        - 到底了 -
      </view>
    </view>

    <!-- 无数据时显示空状态 -->
    <fg-empty v-if="waterfallData.length === 0 && !pageState.loading" class="flex-1" />

    <!-- 底部操作栏 - fixed布局置底 -->
    <view
      v-if="!fromMe"
      class="fixed bottom-0 left-0 z-[999] w-full flex items-center justify-between bg-white pb-40rpx pt-20rpx"
    >
      <!-- 左侧按钮：添加素材 -->
      <view v-if="userInfo.level !== 4" class="h-[60rpx] flex flex-1 items-center justify-center text-[32rpx] text-tip" @click="handleAddAssets">
        <i class="iconfont icon-a-shuxingxianxingmingchengtianjiazhuangtaion text-[32rpx]" />
        <text class="ml-8rpx">添加作品</text>
      </view>
      <view class="h-[60rpx] w-[2rpx] bg-[rgba(102,102,102,0.1)]" />
      <!-- 右侧按钮：编辑管理 -->
      <view
        class="h-[60rpx] flex flex-1 items-center justify-center text-[32rpx] text-[#666]"
        @click="toEditPage"
      >
        <i class="iconfont icon-a-shuxingbianjizhuangtaioff text-[32rpx]" />
        <text class="ml-8rpx">编辑管理</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss"></style>
