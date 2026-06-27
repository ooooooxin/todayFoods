<script lang="ts" setup>
import type { CollectionAssetItem } from '@/api/ip/ip'
import { onLoad, onPageScroll, onReachBottom, onShow } from '@dcloudio/uni-app'
import { reactive, ref } from 'vue'
import { getCollectionAssets } from '@/api/ip/ip'
import { usePageScrollBridge } from '@/hooks/usePageScrollBridge'
import { useWorksDetailsStore } from '@/store/worksDetails'
import { statusNavTotalHeight } from '@/utils/systemInfo'

const worksDetailsStore = useWorksDetailsStore()
usePageScrollBridge()

// 页面参数
const collectionId = ref<string>()
const collectionName = ref('合集详情')

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

onShow(() => {
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
  }
  catch (error) {
    console.error('获取素材列表失败', error)
  }
  finally {
    pageState.loading = false
  }
}

// 处理瀑布流item点击
function handleWaterfallItemClick(item: any, index: number, detail: any) {
  worksDetailsStore.setEntrySource('collection')
  worksDetailsStore.setCurrentItem(item, index, detail)

  // 构建tab列表：当前项 + 前100条 + 后100条
  const tabList = buildTabList(index)
  worksDetailsStore.setPreloadedTabList(tabList)

  uni.navigateTo({
    url: `/pages/worksDetails/index?id=${item.id}`,
  })
}

// 处理素材失效，刷新列表
function handleAssetInvalid() {
  fetchAssetList(true)
}

/**
 * 构建tab列表，包含当前项、前100条和后100条
 * @param currentIndex 当前点击项的索引
 */
function buildTabList(currentIndex: number): any[] {
  const totalCount = waterfallData.value.length
  const result: any[] = []

  // 添加前100条
  const startIndex = Math.max(0, currentIndex - 100)
  for (let i = startIndex; i < currentIndex; i++) {
    const item = waterfallData.value[i]
    result.push({
      id: item.id,
      thumbUrl: item.thumbUrl,
      fileType: item.fileType,
      staticThumbUrl: item.staticThumbUrl,
    })
  }

  // 添加当前项
  const currentItem = waterfallData.value[currentIndex]
  result.push({
    id: currentItem.id,
    thumbUrl: currentItem.thumbUrl,
    fileType: currentItem.fileType,
    staticThumbUrl: currentItem.staticThumbUrl,
  })

  // 添加后100条
  const endIndex = Math.min(totalCount, currentIndex + 101)
  for (let i = currentIndex + 1; i < endIndex; i++) {
    const item = waterfallData.value[i]
    result.push({
      id: item.id,
      thumbUrl: item.thumbUrl,
      fileType: item.fileType,
      staticThumbUrl: item.staticThumbUrl,
    })
  }

  return result
}

// 页面加载时获取参数并加载数据
onLoad((options) => {
  if (options?.id) {
    collectionId.value = options.id
  }
  if (options?.title) {
    collectionName.value = decodeURIComponent(options.title)
  }
  // 初始加载数据
  fetchAssetList(true)
})

// 页面触底事件，加载更多素材
onReachBottom(() => {
  if (!isWaterfallImagesLoaded.value)
    return
  fetchAssetList()
})

onPageScroll(() => {

})
</script>

<template>
  <view class="h-screen flex flex-col">
    <!-- 头部占位 -->
    <CommonHeader mode="fixed" :scroll-top="0" />
    <!-- 页面标题 -->
    <custom-title :text="collectionName" text-color="text-main" />

    <!-- 有数据时显示瀑布流列表 -->
    <view
      v-if="waterfallData.length > 0"
      class="box-border flex-1 pt-24rpx"
      :style="{ paddingTop: `${statusNavTotalHeight}px` }"
    >
      <FgWaterfall
        :list="waterfallData"
        scene="2"
        @item-click="handleWaterfallItemClick"
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

    <!-- 底部占位 -->
    <view class="pb-40rpx" />
  </view>
</template>

<style scoped lang="scss"></style>
