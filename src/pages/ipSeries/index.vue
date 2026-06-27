<script lang="ts" setup>
import { onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { computed, getCurrentInstance, nextTick, onMounted, ref, watch } from 'vue'

import { getIpListBySeriesId, getIpSeriesPageForApp } from '@/api/ip/ip'
import { showCustomToast } from '@/composables/useCustomToast'
import { usePageScrollBridge } from '@/hooks/usePageScrollBridge'
import { usePageScrollStore } from '@/store/pageScroll'
import { getImgUrl, getSearchKeywordParam } from '@/utils'
import { statusNavTotalHeight, systemInfo } from '@/utils/systemInfo'

definePage({
  style: {
    navigationBarTitleText: 'IP系列',
    enablePullDownRefresh: true,
    backgroundColor: '#f5f5f5',
  },
})

interface SeriesItem {
  id: string
  bannerImg: string
  bannerName: string
  hotValue: number
  hotValueStr: string
  detailImgs: string[]
}

const keyWord = ref('')
const pageScrollStore = usePageScrollStore()
usePageScrollBridge()
const displayMode = ref<'carousel' | 'grid'>('grid')
const currentSeriesIndex = ref(0)
const scrollLeft = ref(0) // Control scroll-view position

const gridTop = computed(() => systemInfo.platform === 'ios' ? statusNavTotalHeight + 60 : statusNavTotalHeight + 56)

// ==================== 轮播图分页数据管理 ====================
// 所有缓存的数据（从接口获取的完整数据）
const allCarouselData = ref<SeriesItem[]>([])
// 当前展示的数据（轮播图中实际渲染的数据，只增不减，通过current控制显示位置）
const displayCarouselData = ref<SeriesItem[]>([])
// 当前页码
const currentPage = ref(1)
// 总页数
const totalPages = ref(0)
// 是否正在加载中
const isLoading = ref(false)
// 标记是否正在处理swiper变化（防止重复触发）
const isProcessingSwiperChange = ref(false)
// 标记swiper动画是否完成
const isSwiperAnimationComplete = ref(true)
// 是否还有更多数据
const hasMoreData = ref(true)
// 是否为空数据状态
const isEmpty = ref(false)
// 是否是搜索导致的空数据
const isSearchEmpty = ref(false)

// ==================== 性能优化配置 ====================
// 最大保留数据条数（超过此数量将清理旧数据）
const MAX_KEEP_COUNT = 30
// 缓冲区大小（当前项前后保留的条数）
const BUFFER_SIZE = 8
// 数据起始偏移量（用于虚拟列表）
const dataOffset = ref(0)

// ==================== Carousel 模式尺寸管理 ====================
const instance = getCurrentInstance()
const CAROUSEL_CARD_ASPECT_RATIO = 540 / 742
const CAROUSEL_SIDE_MARGIN_RPX = 105
const CAROUSEL_CARD_HEIGHT_RATIO = 0.95
const carouselCardHeight = ref(uni.upx2px(742))
const carouselCardWidth = ref(uni.upx2px(540))

function updateCarouselCardDimensions() {
  nextTick(() => {
    uni.createSelectorQuery()
      .in(instance?.proxy)
      .select('.carousel-swiper')
      .boundingClientRect((rect: any) => {
        if (!rect?.height)
          return

        const visibleItemWidth = rect.width - uni.upx2px(CAROUSEL_SIDE_MARGIN_RPX * 2)
        const heightLimitedBySwiper = rect.height * CAROUSEL_CARD_HEIGHT_RATIO
        const heightLimitedByWidth = visibleItemWidth / CAROUSEL_CARD_ASPECT_RATIO
        carouselCardHeight.value = Math.min(heightLimitedBySwiper, heightLimitedByWidth)
        carouselCardWidth.value = carouselCardHeight.value * CAROUSEL_CARD_ASPECT_RATIO
      })
      .exec()
  })
}

// 转换接口数据为SeriesItem
function convertToSeriesItem(item: any): SeriesItem {
  return {
    id: item.id,
    bannerImg: item.coverImgUrl || '',
    bannerName: item.name,
    hotValue: item.popularityCount || 0,
    hotValueStr: item.popularityCountStr || '',
    detailImgs: [],
  }
}

// 当前系列下的IP图片列表
const currentDetailImgs = ref<string[]>([])

// 根据系列ID获取IP列表
async function loadIpListBySeriesId(seriesId: string) {
  try {
    const res = await getIpListBySeriesId({ seriesId })
    // 使用mainImgUrl字段渲染图片
    currentDetailImgs.value = res.map(item => item.mainImgUrl || '').filter(url => url)
  }
  catch (error) {
    console.error('获取IP列表失败:', error)
    currentDetailImgs.value = []
  }
}

// 加载轮播图数据
async function loadCarouselData(pageNum: number, seriesName?: string) {
  if (isLoading.value || !hasMoreData.value)
    return
  isLoading.value = true

  try {
    const res = await getIpSeriesPageForApp({
      pageNum,
      pageSize: 10,
      seriesName,
    })

    // 更新分页信息
    totalPages.value = res.pages
    currentPage.value = res.current
    hasMoreData.value = res.current < res.pages

    // 转换数据
    const newData = res.records.map(convertToSeriesItem)

    // 检查是否为空数据
    if (pageNum === 1 && newData.length === 0) {
      isEmpty.value = true
      // 如果有搜索关键词，标记为搜索空数据
      isSearchEmpty.value = !!seriesName
      allCarouselData.value = []
      displayCarouselData.value = []
      currentDetailImgs.value = []
      return
    }

    isEmpty.value = false
    isSearchEmpty.value = false

    // 缓存到allCarouselData（用于反向滑动时恢复数据）
    allCarouselData.value = [...allCarouselData.value, ...newData]

    // 追加到展示数据（只增不减）
    displayCarouselData.value = [...displayCarouselData.value, ...newData]

    // 首次加载：加载第一个系列的IP列表
    if (pageNum === 1 && newData.length > 0) {
      loadIpListBySeriesId(newData[0].id)
    }

    // 加载完成后检查是否需要优化
    nextTick(() => {
      optimizeDataList()
    })
  }
  catch (error) {
    console.error('获取IP系列数据失败:', error)
  }
  finally {
    isLoading.value = false
  }
}

// 初始化加载数据
loadCarouselData(1)

// 记录Carousel模式下的状态（用于从Grid切换回来时恢复）
const carouselState = ref<{
  currentIndex: number
  displayData: SeriesItem[]
  dataOffset: number
} | null>(null)

function toggleDisplayMode() {
  const newMode = displayMode.value === 'carousel' ? 'grid' : 'carousel'

  if (displayMode.value === 'carousel') {
    // 从Carousel切换到Grid：保存Carousel状态
    carouselState.value = {
      currentIndex: currentSeriesIndex.value,
      displayData: [...displayCarouselData.value],
      dataOffset: dataOffset.value,
    }
  }
  else {
    // 从Grid切换到Carousel：恢复Carousel状态
    // 检查当前allCarouselData中是否有比displayCarouselData更多的数据
    const hasMoreDataInAll = allCarouselData.value.length > displayCarouselData.value.length

    if (hasMoreDataInAll) {
      // Grid加载了更多数据，需要重新初始化Carousel的虚拟列表
      // 找到当前应该显示的数据位置
      const targetIndex = currentSeriesIndex.value
      const targetId = displayCarouselData.value[targetIndex]?.id

      // 在allCarouselData中查找对应位置
      const newIndexInAll = allCarouselData.value.findIndex(item => item.id === targetId)

      if (newIndexInAll !== -1) {
        // 重新构建虚拟列表，以当前项为中心
        const keepStart = Math.max(0, newIndexInAll - BUFFER_SIZE)
        const keepEnd = Math.min(allCarouselData.value.length, newIndexInAll + BUFFER_SIZE + 1)

        displayCarouselData.value = allCarouselData.value.slice(keepStart, keepEnd)
        dataOffset.value = keepStart
        currentSeriesIndex.value = newIndexInAll - keepStart
      }
    }
    // 如果没有更多数据，保持当前的displayCarouselData不变

    // 加载当前系列的IP列表
    const currentSeries = displayCarouselData.value[currentSeriesIndex.value]
    if (currentSeries?.id) {
      loadIpListBySeriesId(currentSeries.id)
    }
  }

  displayMode.value = newMode
  if (newMode === 'carousel') {
    updateCarouselCardDimensions()
  }
}

// 跳转到系列详情页
function goToSeriesDetail(seriesId: string) {
  uni.navigateTo({
    url: `/pages/ipSeriesDetails/index?seriesId=${seriesId}`,
  })
}

// 优化数据列表（清理视口外的数据，保留缓冲区）
function optimizeDataList() {
  const currentIndex = currentSeriesIndex.value
  const totalCount = displayCarouselData.value.length

  // 如果数据量未超过阈值，不清理
  if (totalCount <= MAX_KEEP_COUNT)
    return

  // 计算应该保留的数据范围
  const keepStart = Math.max(0, currentIndex - BUFFER_SIZE)
  const keepEnd = Math.min(totalCount, currentIndex + BUFFER_SIZE + 1)

  // 只有当需要清理的数据超过5条时才执行（减少清理频率）
  if (keepStart - dataOffset.value >= 5) {
    // 清理前面不需要的数据
    const newOffset = dataOffset.value + keepStart
    displayCarouselData.value = displayCarouselData.value.slice(keepStart, keepEnd)
    dataOffset.value = newOffset
    // 调整当前索引
    currentSeriesIndex.value = currentIndex - keepStart
  }
}

// 检查是否需要恢复前面已清理的数据（反向滑动时）
function checkRestoreData() {
  const currentIndex = currentSeriesIndex.value

  // 如果当前索引小于3，且前面有已清理的数据，需要恢复
  if (currentIndex < 3 && dataOffset.value > 0) {
    // 计算需要恢复的数据条数（最多恢复10条）
    const restoreCount = Math.min(10, dataOffset.value)
    const restoreStart = dataOffset.value - restoreCount

    // 从allCarouselData中恢复数据
    const restoreData = allCarouselData.value.slice(restoreStart, dataOffset.value)

    // 恢复数据到展示列表
    displayCarouselData.value = [...restoreData, ...displayCarouselData.value]
    dataOffset.value = restoreStart
    currentSeriesIndex.value = currentIndex + restoreCount
  }
}

// 检查是否需要加载更多数据
function checkLoadMore() {
  // 等待动画完成后再加载，避免动画闪动
  if (!isSwiperAnimationComplete.value) {
    return
  }

  const currentIndex = currentSeriesIndex.value
  const totalCount = displayCarouselData.value.length

  // 当滑动到剩余数据不足5条时，提前加载下一页
  if (currentIndex >= totalCount - 5 && hasMoreData.value && !isLoading.value) {
    loadCarouselData(Number(currentPage.value) + 1)
  }

  // 检查是否需要优化数据列表
  optimizeDataList()
}

function onSwiperChange(e: any) {
  if (isProcessingSwiperChange.value)
    return
  isProcessingSwiperChange.value = true
  // 动画开始，标记为未完成
  isSwiperAnimationComplete.value = false

  const newIndex = e.detail.current
  const oldIndex = currentSeriesIndex.value

  // 更新当前索引
  currentSeriesIndex.value = newIndex

  // 判断滑动方向
  const direction = newIndex > oldIndex ? 'forward' : 'backward'

  // 反向滑动时检查是否需要恢复数据
  if (direction === 'backward') {
    checkRestoreData()
  }

  // 切换轮播图后获取对应系列的IP列表
  const currentSeries = displayCarouselData.value[currentSeriesIndex.value]
  if (currentSeries?.id) {
    loadIpListBySeriesId(currentSeries.id)
  }

  // 重置处理标记，并在动画完成后检查是否需要加载更多
  nextTick(() => {
    isProcessingSwiperChange.value = false
    // 延迟标记动画完成（swiper切换动画大约300ms）
    setTimeout(() => {
      isSwiperAnimationComplete.value = true
      // 动画完成后检查是否需要加载更多
      if (direction === 'forward') {
        checkLoadMore()
      }
    }, 300)
  })
}

// 搜索防抖计时器
let searchTimer: ReturnType<typeof setTimeout> | null = null

// 监听搜索输入变化，防抖搜索
watch(keyWord, () => {
  // 清除之前的计时器
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  // 300ms 后触发搜索
  searchTimer = setTimeout(() => {
    // 清空页面数据
    allCarouselData.value = []
    displayCarouselData.value = []
    currentPage.value = 1
    totalPages.value = 0
    hasMoreData.value = true
    dataOffset.value = 0
    currentSeriesIndex.value = 0
    currentDetailImgs.value = []

    // 调用接口加载数据，传入搜索关键词
    loadCarouselData(1, getSearchKeywordParam(keyWord.value))
  }, 300)
})

// 清空搜索
function onClearSearch() {
  keyWord.value = ''
}

// 搜索
async function onSearch() {
  // 清除防抖计时器，立即执行搜索
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  // 清空页面数据
  allCarouselData.value = []
  displayCarouselData.value = []
  currentPage.value = 1
  totalPages.value = 0
  hasMoreData.value = true
  dataOffset.value = 0
  currentSeriesIndex.value = 0
  currentDetailImgs.value = []

  // 调用接口加载数据，传入搜索关键词
  await loadCarouselData(1, getSearchKeywordParam(keyWord.value))
}

// 当索引变化时重置滚动视图位置
watch(currentSeriesIndex, () => {
  // 重置滚动位置到0
  // 注意：如果已经是0，则设置为0.1强制更新
  scrollLeft.value = scrollLeft.value === 0 ? 0.1 : 0
})

// 页面下拉刷新（备用）
const isRefreshing = ref(false)
onPullDownRefresh(async () => {
  await handleRefresh()
  uni.stopPullDownRefresh()
})

// 页面触底加载更多（Grid模式）
onReachBottom(() => {
  if (displayMode.value === 'grid' && hasMoreData.value && !isLoading.value) {
    loadCarouselData(Number(currentPage.value) + 1, getSearchKeywordParam(keyWord.value))
  }
})

// 下拉刷新处理函数
async function handleRefresh() {
  if (isRefreshing.value)
    return
  isRefreshing.value = true
  try {
    // 重置所有数据状态
    allCarouselData.value = []
    displayCarouselData.value = []
    currentPage.value = 1
    totalPages.value = 0
    hasMoreData.value = true
    dataOffset.value = 0
    currentSeriesIndex.value = 0
    currentDetailImgs.value = []
    isEmpty.value = false
    isSearchEmpty.value = false

    // 重新加载数据
    await loadCarouselData(1, getSearchKeywordParam(keyWord.value))
    showCustomToast({ title: '刷新成功', icon: 'none', duration: 1000 })
  }
  catch {
    showCustomToast({ title: '刷新失败', icon: 'none', duration: 1000 })
  }
  finally {
    isRefreshing.value = false
  }
}

onMounted(() => {
  updateCarouselCardDimensions()
})

onShow(() => {
  pageScrollStore.setToTopBottom('72rpx')
  if (displayMode.value === 'carousel') {
    updateCarouselCardDimensions()
  }
  setTimeout(() => {
    if (uni.getStorageSync('needRefreshFromException') === '1') {
      uni.removeStorageSync('needRefreshFromException')
      allCarouselData.value = []
      displayCarouselData.value = []
      currentPage.value = 1
      totalPages.value = 0
      hasMoreData.value = true
      dataOffset.value = 0
      currentSeriesIndex.value = 0
      currentDetailImgs.value = []
      loadCarouselData(1, getSearchKeywordParam(keyWord.value))
    }
  }, 100)
})

onPageScroll((e) => {

})

onShareAppMessage(() => {
  let shareImage = ''
  // #ifdef MP-TOUTIAO
  shareImage = getImgUrl('/assets/mp/temp/tt_share.png')
  // #endif
  // #ifdef MP-WEIXIN
  shareImage = getImgUrl('/assets/mp/temp/wx_share.png')
  // #endif

  return {
    path: '/pages/index/index',
    imageUrl: shareImage,
  }
})
</script>

<template>
  <view class="relative h-screen flex flex-col">
    <CommonHeader mode="fixed" :scroll-top="0" bg-color="white" />
    <custom-title text="IP系列" text-color="text-main" />
    <!-- 固定顶部区域 -->
    <view class="fixed z-50 w-full flex flex-shrink-0 items-center justify-between bg-white px-30rpx py-20rpx" :style="{ top: `${statusNavTotalHeight}px` }">
      <!-- 搜索框 -->
      <view class="flex-1">
        <view class="h-80rpx flex items-center rounded-45rpx bg-[#F5F5F5]">
          <image src="/src/static/images/ic_search.png" mode="scaleToFill" class="ml-[24rpx] h-40rpx w-40rpx" />
          <view class="h-full flex flex-1 items-center">
            <input
              v-model="keyWord" class="h-full flex-1 pl-[20rpx] pr-[12rpx] text-28rpx text-main" type="text"
              placeholder="请输入IP系列名称" placeholder-style="color:#999;font-size:28rpx;"
            >
            <view
              v-if="keyWord"
              class="mr-[12rpx] h-48rpx w-48rpx flex items-center justify-center"
              @click="onClearSearch"
            >
              <image
                src="/static/images/ic_clear.png"
                class="h-32rpx w-32rpx"
              />
            </view>
          </view>
          <view
            class="mr-[24rpx] border-l-[2rpx] border-l-[rgba(102,102,102,0.1)] border-solid b-b-none b-r-none b-t-none pl-24rpx text-28rpx text-main font-bold"
            @click="onSearch"
          >
            搜索
          </view>
        </view>
      </view>
      <view class="ml-20rpx flex flex-col items-center justify-center" @click="toggleDisplayMode">
        <image
          v-if="displayMode === 'carousel'" src="/src/static/images/switch1.png" mode="scaleToFill"
          class="mr-8rpx h-44rpx w-44rpx"
        />
        <image v-else src="/src/static/images/switch.png" mode="scaleToFill" class="mr-8rpx h-44rpx w-44rpx" />
        <text class="mode-text mt-4rpx text-20rpx text-[#333]">切换展示</text>
      </view>
    </view>
    <view v-show="displayMode === 'grid'" class="pointer-events-none fixed left-0 w-full" :style="{ top: `${gridTop}px` }" style="height: 80rpx; background: linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0));" />
    <!-- 无数据时显示空状态 -->
    <fg-empty v-if="isEmpty" type="content" :text="isSearchEmpty ? '未找到相关系列IP，换个关键词试试吧' : '没有内容'" class="relative flex-1" />

    <view v-else class="relative min-h-0 flex flex-1 flex-col" :style="{ paddingTop: `${gridTop}px` }">
      <!-- Carousel 模式 -->
      <view v-show="displayMode === 'carousel'" class="min-h-0 flex flex-1 flex-col bg-[#fff]">
        <!-- 轮播图 105rpx -->
        <swiper
          class="carousel-swiper min-h-0 w-full flex-1" :current="currentSeriesIndex" previous-margin="105rpx"
          next-margin="105rpx" :autoplay="false" :circular="false" :duration="300" @change="onSwiperChange"
        >
          <swiper-item
            v-for="(item, index) in displayCarouselData" :key="`${item.id}-${index}`"
            class="flex items-center justify-center"
            @click="goToSeriesDetail(item.id)"
          >
            <view
              class="relative overflow-hidden rounded-16rpx transition-all duration-300 ease"
              :class="[index === currentSeriesIndex ? 'scale-100 opacity-100 z-10' : 'scale-75 opacity-80']"
              :style="{ height: `${carouselCardHeight}px`, width: `${carouselCardWidth}px` }"
            >
              <ImagePlaceholder :src="item.bannerImg" mode="aspectFit" class-name="h-full w-full" lazy-load />
              <!-- Mask -->
              <view
                class="absolute bottom-0 left-0 box-border h-160rpx w-full flex flex-col justify-center from-[rgba(24,24,24,0.6)] to-[rgba(24,24,24,0)] bg-gradient-to-t px-30rpx"
              >
                <view class="truncate text-32rpx text-white font-bold line-height-48rpx">
                  {{ item.bannerName }}
                </view>

                <view class="mt-16rpx flex items-center justify-between text-20rpx">
                  <!-- <view>
                    <image
                      src=""
                      mode="scaleToFill" class="mr-8rpx h-40rpx w-40rpx"
                    />
                    <text></text>
                  </view> -->
                  <text v-if="item.hotValue > 0" class="text-white line-height-36rpx">人气值：{{ item.hotValueStr }}</text>
                </view>
              </view>
            </view>
          </swiper-item>
        </swiper>

        <image
          src="/static/images/logo_mask.png"
          mode="widthFix"
          class="absolute bottom-68rpx left-0 w-full"
        />

        <!-- 底部系列图片 -->
        <scroll-view
          class="mt-56rpx h-260rpx w-full shrink-0 whitespace-nowrap pb-40rpx" scroll-x :scroll-left="scrollLeft"
          :scroll-with-animation="true"
        >
          <view class="inline-flex px-30rpx">
            <view
              v-for="(img, idx) in currentDetailImgs" :key="idx"
              class="mr-20rpx h-260rpx w-174rpx shrink-0 overflow-hidden rounded-12rpx last:mr-0"
            >
              <!-- <image :src="img" mode="aspectFill" class="h-full w-full" lazy-load /> -->
              <ImagePlaceholder :src="img" mode="aspectFill" class-name="h-260rpx w-174rpx" />
            </view>
          </view>
        </scroll-view>
      </view>
      <!-- Grid 模式 -->
      <view v-show="displayMode === 'grid'" class="relative mt-16rpx box-border">
        <IpSeriesGridWaterfall :list="allCarouselData" @item-click="goToSeriesDetail" />
        <!-- 加载状态 -->
        <view class="flex items-center justify-center py-[30rpx]">
          <text v-if="isLoading" class="text-24rpx text-[#999]">加载中...</text>
          <text v-else-if="!hasMoreData" class="text-24rpx text-[#999]">- 到底了 -</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
