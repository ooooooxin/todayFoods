<script lang="ts" setup>
import { onLoad, onPageScroll, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, nextTick, ref } from 'vue'
import { getCollectionAssets } from '@/api/ip/ip'
import { getCreatorCollectionList } from '@/api/me/me'
import { useWorksDetailsStore } from '@/store/worksDetails'
import { statusNavTotalHeight } from '@/utils/systemInfo'

// WorksDetails Store
const worksDetailsStore = useWorksDetailsStore()

// 创作者ID
const creatorId = ref('')

// 合集ID
const collectionId = ref('')

// ==================== 圆形Tab轮播组件（Swiper实现） ====================
// 合集列表数据
const circleTabs = ref<any[]>([])

// 当前可视区起始索引（控制 swiper 滚动位置）
const circleTabScrollIndex = ref(0)

const displayMultipleItems = computed(() => Math.min(5, circleTabs.value.length))

// 视觉激活的Tab索引（控制样式，不影响swiper位置）
const visualActiveCircleTabIndex = ref(0)

// 切换锁，防止重复触发
let isSwitching = false

// Swiper动画完成标记
const isSwiperAnimationComplete = ref(true)

const upx2px = (rpx: number) => uni.upx2px(rpx)

function getCircleTabScrollIndex(activeIndex: number): number {
  const total = circleTabs.value.length
  const visibleCount = displayMultipleItems.value
  if (total === 0)
    return 0
  if (total <= visibleCount)
    return 0

  const maxStartIndex = total - visibleCount
  if (activeIndex >= maxStartIndex)
    return maxStartIndex

  return Math.max(0, activeIndex - Math.floor(visibleCount / 2))
}

// Swiper切换事件
async function onSwiperChange(e: any) {
  if (isSwitching)
    return
  isSwitching = true
  isSwiperAnimationComplete.value = false

  const newIndex = e.detail.current
  const oldIndex = circleTabScrollIndex.value

  circleTabScrollIndex.value = newIndex

  const direction = newIndex > oldIndex ? 'forward' : 'backward'

  nextTick(() => {
    isSwitching = false
    setTimeout(() => {
      isSwiperAnimationComplete.value = true
      if (direction === 'forward') {
        // 加载更多
      }
    }, 300)
  })
}

// 点击Tab切换
function onSwiperTabClick(index: number) {
  if (index === visualActiveCircleTabIndex.value)
    return
  visualActiveCircleTabIndex.value = index

  // 切换合集并重新加载素材列表
  if (circleTabs.value[index]) {
    collectionId.value = String(circleTabs.value[index].id)
    loadCollectionAssets(true)
  }

  uni.pageScrollTo({ scrollTop: 0 })
}

// 当前选中标签的名称
const currentTabName = computed(() => circleTabs.value[visualActiveCircleTabIndex.value]?.name || '合集')

// 加载创作者合集列表
async function loadCreatorCollections(targetCollectionId?: string) {
  if (!creatorId.value)
    return
  try {
    const result = await getCreatorCollectionList(creatorId.value)
    // 接口数据赋值给circleTabs
    circleTabs.value = result.records.map(item => ({
      id: item.id,
      name: item.title,
      avatarImgUrl: item.topAssets?.[0]?.thumbUrl || '',
    }))

    // 查找匹配的合集
    let targetIndex = 0
    if (targetCollectionId && circleTabs.value.length > 0) {
      const matchedIndex = circleTabs.value.findIndex(tab => String(tab.id) === targetCollectionId)
      if (matchedIndex !== -1) {
        targetIndex = matchedIndex
      }
    }

    // 激活目标合集（匹配上的或第一个）
    if (circleTabs.value.length > 0) {
      visualActiveCircleTabIndex.value = targetIndex
      circleTabScrollIndex.value = getCircleTabScrollIndex(targetIndex)
      collectionId.value = String(circleTabs.value[targetIndex].id)
      // 加载该合集的素材（刷新模式）
      loadCollectionAssets(true)
    }
  }
  catch (error) {
    console.error('加载创作者合集失败:', error)
  }
}

// 瀑布流数据
const waterfallData = ref<any[]>([])

// 分页状态
const pageState = {
  nextCursorId: undefined as string | undefined,
  nextCursorIsTop: undefined as number | undefined,
  nextCursorSort: undefined as number | undefined,
  hasNext: true,
  loading: false,
}
// 瀑布流图片是否全部加载完成
const isWaterfallImagesLoaded = ref(false)

// 加载合集素材列表
async function loadCollectionAssets(isRefresh = false) {
  if (!collectionId.value || pageState.loading || (!pageState.hasNext && !isRefresh))
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
    const result = await getCollectionAssets({
      collectionId: collectionId.value,
      pageSize: 20,
      ...(pageState.nextCursorId !== undefined
        ? {
            cursorId: String(pageState.nextCursorId),
            cursorIsTop: pageState.nextCursorIsTop,
            cursorSort: pageState.nextCursorSort,
          }
        : {}),
    })

    const mappedRecords = result.records.map(item => ({
      id: item.id,
      relationId: item.relationId,
      sort: item.sort,
      thumbUrl: item.thumbUrl,
      staticThumbUrl: item.staticThumbUrl,
      fileType: item.fileType,
      categoryName: item.categoryName,
      isTop: item.isTop,
      likeCountFormatted: item.likeCountFormatted,
      downloadCountFormatted: item.downloadCountFormatted,
    }))

    if (isRefresh) {
      waterfallData.value = mappedRecords
    }
    else {
      waterfallData.value.push(...mappedRecords)
    }

    pageState.nextCursorId = result.nextCursorId ?? undefined
    pageState.nextCursorIsTop = result.nextCursorIsTop ?? undefined
    pageState.nextCursorSort = result.nextCursorSort ?? undefined
    pageState.hasNext = result.hasNext
  }
  catch (error) {
    console.error('加载合集素材失败:', error)
  }
  finally {
    pageState.loading = false
  }
}

// 触底加载更多（页面级）
onReachBottom(() => {
  loadCollectionAssets()
})

// scroll-view 触底加载更多
function handleScrollToLower() {
  loadCollectionAssets()
}

// 页面加载时获取creatorId并加载数据
onLoad((options) => {
  console.log(options)

  if (options?.creatorId) {
    creatorId.value = options.creatorId as string
    // 保存传入的collectionId用于匹配
    const targetCollectionId = options.id as string | undefined
    loadCreatorCollections(targetCollectionId)
  }
})

onShow(() => {
  setTimeout(() => {
    if (uni.getStorageSync('needRefreshFromException') === '1') {
      uni.removeStorageSync('needRefreshFromException')
      loadCreatorCollections(creatorId.value)
    }
  }, 100)
})

// 处理瀑布流item点击
function handleWaterfallItemClick(item: any, index: number, detail: any) {
  worksDetailsStore.setEntrySource('collection')
  worksDetailsStore.setCurrentItem(item, index, detail)

  // 构建tab列表：当前项 + 前100条 + 后100条
  const tabList = buildTabList(index)
  worksDetailsStore.setPreloadedTabList(tabList)

  // 传递当前激活的tab项的title
  const currentTabTitle = circleTabs.value[visualActiveCircleTabIndex.value]?.name || ''
  uni.navigateTo({
    url: `/pages/worksDetails/index?id=${item.id}&title=${encodeURIComponent(currentTabTitle)}`,
  })
}

/**
 * 构建tab列表，包含当前项、前100条和后100条
 * 只保留id和thumbUrl字段，id字段统一从id/assetsId/contentId中获取
 * @param currentIndex 当前点击项的索引
 * @returns 构建好的tab列表
 */
function buildTabList(currentIndex: number): any[] {
  const totalCount = waterfallData.value.length
  const result: any[] = []

  // 添加前100条（如果存在）
  const startIndex = Math.max(0, currentIndex - 100)
  for (let i = startIndex; i < currentIndex; i++) {
    const item = waterfallData.value[i]
    result.push({
      id: item.id || item.assetsId || item.contentId,
      thumbUrl: item.thumbUrl,
      fileType: item.fileType,
      staticThumbUrl: item.staticThumbUrl,
    })
  }

  // 添加当前项
  const currentItem = waterfallData.value[currentIndex]
  result.push({
    id: currentItem.id || currentItem.assetsId || currentItem.contentId,
    thumbUrl: currentItem.thumbUrl,
    fileType: currentItem.fileType,
    staticThumbUrl: currentItem.staticThumbUrl,
  })

  // 添加后100条（如果存在）
  const endIndex = Math.min(totalCount, currentIndex + 101)
  for (let i = currentIndex + 1; i < endIndex; i++) {
    const item = waterfallData.value[i]
    result.push({
      id: item.id || item.assetsId || item.contentId,
      thumbUrl: item.thumbUrl,
      fileType: item.fileType,
      staticThumbUrl: item.staticThumbUrl,
    })
  }
  return result
}

function handleAssetInvalid() {
  loadCollectionAssets(true)
}

onPageScroll((e) => {

})
</script>

<template>
  <view class="relative h-screen flex flex-col overflow-hidden">
    <CommonHeader mode="auto" :scroll-top="0" />

    <!-- 背景图 -->
    <image
      class="absolute left-0 top-0 h-686rpx w-full"
      src="/static/images/bg_logo.png"
      mode="scaleToFill"
    />

    <!-- 页面标题 -->
    <custom-title :text="currentTabName" text-color="text-main" />
    <!-- 顶部Tab轮播组件（Swiper实现） -->
    <view class="fixed left-0 right-0 z-100 h-192rpx overflow-hidden" :style="{ top: `${statusNavTotalHeight}px` }">
      <!-- 少于等于 5 个时用固定 5 槽布局，避免 swiper 自动平分导致分散排布 -->
      <view v-if="circleTabs.length <= 5" class="relative z-2 h-full w-full flex">
        <view v-for="(tab, index) in circleTabs" :key="tab.id" class="h-full flex flex-col items-center pt-16rpx" style="width: 20%;">
          <view
            class="h-136rpx w-136rpx flex items-center justify-center transition-all duration-300" @click="onSwiperTabClick(index)"
          >
            <view class="border-[4rpx] rounded-[12rpx] border-solid p-[4rpx] transition-colors duration-200" :style="{ borderColor: visualActiveCircleTabIndex === index ? '#333' : 'transparent' }">
              <ImagePlaceholder :src="tab.avatarImgUrl" mode="aspectFill" class-name="h-[100rpx] w-[100rpx] rounded-[8rpx]" />
            </view>
          </view>
          <text class="w-[100rpx] truncate text-center text-[20rpx] text-[#333] leading-[36rpx]" :class="visualActiveCircleTabIndex === index ? 'font-semibold' : ''">
            {{ tab.name }}
          </text>
        </view>
      </view>

      <!-- 超过 5 个时使用 swiper 滚动区域 -->
      <swiper
        v-else
        class="relative z-2 h-full" :current="circleTabScrollIndex" :circular="false" :display-multiple-items="displayMultipleItems" @change="onSwiperChange"
      >
        <swiper-item v-for="(tab, index) in circleTabs" :key="tab.id" class="h-full flex flex-col items-center pt-16rpx">
          <view
            class="h-136rpx w-136rpx flex items-center justify-center transition-all duration-300" @click="onSwiperTabClick(index)"
          >
            <view class="border-[4rpx] rounded-[12rpx] border-solid p-[4rpx] transition-colors duration-200" :style="{ borderColor: visualActiveCircleTabIndex === index ? '#333' : 'transparent' }">
              <ImagePlaceholder :src="tab.avatarImgUrl" mode="aspectFill" class-name="h-[100rpx] w-[100rpx] rounded-[8rpx]" />
            </view>
          </view>
          <text class="w-[100rpx] truncate text-center text-[20rpx] text-[#333] leading-[36rpx]" :class="visualActiveCircleTabIndex === index ? 'font-semibold' : ''">
            {{ tab.name }}
          </text>
        </swiper-item>
      </swiper>
    </view>

    <!-- 主内容区域 -->
    <!-- <view class="relative z-10 flex flex-1 flex-col overflow-hidden"> -->
    <!-- 瀑布流内容区域 -->
    <view class="flex-1 overflow-hidden" :style="{ paddingTop: `${upx2px(192) + upx2px(16)}px` }">
      <!-- 有数据时显示列表 -->
      <scroll-view v-if="waterfallData.length > 0" class="h-full" scroll-y @scrolltolower="handleScrollToLower">
        <FgWaterfall
          :list="waterfallData"
          :has-top-label="true"
          scene="1"
          @item-click="handleWaterfallItemClick"
          @asset-invalid="handleAssetInvalid"
          @all-images-loaded="isWaterfallImagesLoaded = true"
        />
        <!-- 底部提示：有数据、没有下一页、且图片全部加载完成时显示 -->
        <view v-if="!pageState.hasNext && !pageState.loading && isWaterfallImagesLoaded" class="py-40rpx text-center text-24rpx text-gray-400">
          - 到底了 -
        </view>
        <view class="pb-48rpx" />
      </scroll-view>
      <!-- 无数据时显示空状态 -->
      <fg-empty v-if="waterfallData.length === 0 && !pageState.loading" type="content" class="h-full" />
    </view>
    <!-- </view> -->
  </view>
</template>

<style scoped lang="scss">
/* 单行省略 */
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 激活标签阴影效果 */
.tab-active {
  box-shadow: 0 12rpx 12rpx 0 rgba(0, 0, 0, 0.2);
}
</style>
