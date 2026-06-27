<script lang="ts" setup>
import type { BrowsingHistoryItem } from '@/api/me/me'
import { onLoad, onPageScroll, onReachBottom, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { getBrowsingHistoryList } from '@/api/me/me'
import { usePageScrollBridge } from '@/hooks/usePageScrollBridge'
import { usePageScrollStore } from '@/store/pageScroll'
import { useWorksDetailsStore } from '@/store/worksDetails'
import { statusNavTotalHeight } from '@/utils/systemInfo'

definePage({
  style: {
    navigationBarTitleText: '浏览记录',
  },
})

const historyData = ref<any[]>([])
const worksDetailsStore = useWorksDetailsStore()
const pageScrollStore = usePageScrollStore()
usePageScrollBridge()
const pageState = {
  lastUpdateTime: undefined as number | undefined,
  hasNext: true,
  loading: false,
}
// 瀑布流图片是否全部加载完成
const isWaterfallImagesLoaded = ref(false)

/**
 * 将 BrowsingHistoryItem 映射成 FgWaterfall 需要的格式
 */
function mapItem(item: BrowsingHistoryItem) {
  return {
    id: item.entityId,
    relationId: item.id,
    thumbUrl: item.thumbUrl,
    categoryName: '',
    isTop: 0,
    likeCountFormatted: '',
    downloadCountFormatted: '',
    viewTime: item.viewTime,
  }
}

async function fetchHistoryList(isRefresh = false) {
  if (pageState.loading || (!pageState.hasNext && !isRefresh))
    return
  pageState.loading = true

  if (isRefresh) {
    pageState.lastUpdateTime = undefined
    pageState.hasNext = true
  }
  // 重置图片加载状态
  isWaterfallImagesLoaded.value = false

  try {
    const res = await getBrowsingHistoryList({
      pageSize: 20,
      entityType: 3,
      lastUpdateTime: pageState.lastUpdateTime,
    })

    const mapped = (res.records || []).map(mapItem)

    if (isRefresh) {
      historyData.value = mapped
      // historyData.value = []
    }
    else {
      historyData.value.push(...mapped)
    }

    // 用最后一条记录的 viewTime 时间戳作为下次游标
    const lastRecord = res.records?.[res.records.length - 1]
    pageState.lastUpdateTime = lastRecord
      ? new Date(lastRecord.viewTime).getTime()
      : pageState.lastUpdateTime
    pageState.hasNext = res.hasNext
  }
  catch (error) {
    console.error('获取浏览记录失败', error)
  }
  finally {
    pageState.loading = false
  }
}

onLoad(() => {
  fetchHistoryList(true)
})

// 页面显示时检查是否需要刷新（与首页/我的等页一致：延迟读取，避免返回时异常页 onHide 尚未写入 storage）
onShow(() => {
  pageScrollStore.setToTopBottom('72rpx')
  setTimeout(() => {
    checkAndRefresh()
  }, 100)
})

// 检查并刷新的函数
function checkAndRefresh() {
  try {
    const needRefresh = uni.getStorageSync('needRefreshFromException')
    console.log('needRefresh', needRefresh)
    if (needRefresh === '1') {
      // 先清除标志，避免重复刷新
      uni.removeStorageSync('needRefreshFromException')
      // 执行刷新
      fetchHistoryList(true)
    }
  }
  catch (e) {
    console.error('检查刷新标志失败:', e)
  }
}

onReachBottom(() => {
  fetchHistoryList()
})

// 处理瀑布流item点击
function handleWaterfallItemClick(item: any, index: number, detail: any) {
  // 存储页面状态到store
  worksDetailsStore.setEntrySource('history')
  // 不再使用setApiParams传参数，而是构建前后20条的tab列表
  worksDetailsStore.setCurrentItem(item, index, detail)

  // 构建tab列表：当前项 + 前20条 + 后20条
  const tabList = buildTabList(index)
  worksDetailsStore.setPreloadedTabList(tabList)

  uni.navigateTo({
    url: `/pages/worksDetails/index?id=${item.id}`,
  })
}

/**
 * 构建tab列表，包含当前项、前100条和后100条
 * 只保留id和thumbUrl字段，id字段统一从id/assetsId/contentId中获取
 * @param currentIndex 当前点击项的索引
 * @returns 构建好的tab列表
 */
function buildTabList(currentIndex: number): any[] {
  const totalCount = historyData.value.length
  const result: any[] = []

  // 添加前100条（如果存在）
  const startIndex = Math.max(0, currentIndex - 100)
  for (let i = startIndex; i < currentIndex; i++) {
    const item = historyData.value[i]
    result.push({
      id: item.id || item.assetsId || item.contentId,
      thumbUrl: item.thumbUrl,
      fileType: item.fileType,
      staticThumbUrl: item.staticThumbUrl,
    })
  }

  // 添加当前项
  const currentItem = historyData.value[currentIndex]
  result.push({
    id: currentItem.id || currentItem.assetsId || currentItem.contentId,
    thumbUrl: currentItem.thumbUrl,
    fileType: currentItem.fileType,
    staticThumbUrl: currentItem.staticThumbUrl,
  })

  // 添加后100条（如果存在）
  const endIndex = Math.min(totalCount, currentIndex + 101)
  for (let i = currentIndex + 1; i < endIndex; i++) {
    const item = historyData.value[i]
    result.push({
      id: item.id || item.assetsId || item.contentId,
      thumbUrl: item.thumbUrl,
      fileType: item.fileType,
      staticThumbUrl: item.staticThumbUrl,
    })
  }

  return result
}

onPageScroll((e) => {

})
</script>

<template>
  <view class="h-screen flex flex-col">
    <CommonHeader mode="fixed" :scroll-top="0" bg-color="#f5f5f5" />
    <custom-title text="浏览记录" text-color="text-main" />
    <!-- 有数据时显示列表 -->
    <view v-if="historyData.length > 0" class="flex-1" :style="{ paddingTop: `${statusNavTotalHeight}px` }">
      <FgWaterfall :list="historyData" :has-top-label="false" :has-bottom-info="false" scene="1" @item-click="handleWaterfallItemClick" @all-images-loaded="isWaterfallImagesLoaded = true" />
      <view v-if="!pageState.hasNext && isWaterfallImagesLoaded" class="py-40rpx text-center text-24rpx text-gray-400">
        - 到底了 -
      </view>
    </view>
    <!-- 无数据时显示空状态 -->
    <fg-empty v-if="historyData.length === 0 && !pageState.loading" class="flex-1" />
  </view>
</template>
