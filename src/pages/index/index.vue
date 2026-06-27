<script lang="ts" setup>
import type { HomeBannerItem, RecommendItem } from '@/api/home/home'
import { onHide, onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { ref, watch, onMounted } from 'vue'
import { getOnShelfSeriesBanners, getRecommendList, homeSearch } from '@/api/home/home'
import { useCategoryFilter } from '@/composables/useCategoryFilter'
import { showCustomToast } from '@/composables/useCustomToast'
import { getListSectionMinHeightStyle, HOME_STICKY_HEIGHT_RPX } from '@/constants/listSectionLayout'
import { usePageScrollBridge } from '@/hooks/usePageScrollBridge'
import { usePageScrollStore } from '@/store/pageScroll'
import { useWorksDetailsStore } from '@/store/worksDetails'
import { getImgUrl, getSearchKeywordParam } from '@/utils'
import { statusNavTotalHeight } from '@/utils/systemInfo'

defineOptions({
  name: 'Home',
})

const upx2px = (rpx: number) => uni.upx2px(rpx)

/** 瀑布流区 min-height：100vh - 状态栏导航 - 筛选 sticky 区（与模板筛选栏高度对应） */
const homeListSectionMinStyle = getListSectionMinHeightStyle({ stickyHeightRpx: HOME_STICKY_HEIGHT_RPX })

const worksDetailsStore = useWorksDetailsStore()
const pageScrollStore = usePageScrollStore()
usePageScrollBridge()

// 推荐素材数据
const waterfallData = ref<RecommendItem[]>([])

// 分页游标
const nextCursorId = ref(0)
const nextCursorScore = ref(0)
const hasMore = ref(true)

// 加载状态
const isLoading = ref(false)
// 瀑布流图片是否全部加载完成
const isWaterfallImagesLoaded = ref(false)

const headerScrollTop = ref(0)
// 筛选栏是否已置顶
const isFilterSticky = ref(false)
// 筛选栏置顶时的滚动位置
const filterStickyScrollTop = ref(0)

definePage({
  // 使用 type: "home" 属性设置首页，其他页面不需要设置，默认为page
  type: 'home',
  style: {
    // 'custom' 表示开启自定义导航栏，默认 'default'
    // navigationStyle: 'custom',
    navigationBarTitleText: '首页',
    enablePullDownRefresh: true,
  },
})

// 使用新的 composable 管理一级和二级分类
const categoryFilter = useCategoryFilter({
  enableSubTabSync: true,
})

const sortOptions = ['热门', '最新']
const currentSort = ref('热门')
const isSortOpen = ref(false)

const keyword = ref('')

// 首页Banner数据
const banners = ref<HomeBannerItem[]>([])
const bannerSwiperCurrent = ref(0)

function onBannerSwiperChange(e: { detail?: { current?: number } }) {
  const c = e.detail?.current
  if (typeof c === 'number')
    bannerSwiperCurrent.value = c
}

watch(banners, () => {
  bannerSwiperCurrent.value = 0
})

async function loadBanners() {
  try {
    const data = await getOnShelfSeriesBanners<HomeBannerItem>()
    banners.value = data
  }
  catch (error: any) {
    console.error('错误详情:', error.errMsg, error.errNo, error.errorCode)
  }
}

function handleTabClick(index: number) {
  const tab = categoryFilter.tabs.value[index]
  if (tab) {
    categoryFilter.selectTab(tab.id)
  }
  // 切换 tab 时隐藏下拉菜单
  closeSort()
  // 如果筛选栏已置顶，保持置顶位置；否则滚动到顶部
  if (isFilterSticky.value) {
    uni.pageScrollTo({
      scrollTop: filterStickyScrollTop.value,
      duration: 0,
    })
  }
  loadRecommendList()
}

function handleSubTabClick(index: number) {
  const tab = categoryFilter.subTabs.value[index]
  if (tab) {
    categoryFilter.selectSubTab(tab.id)
  }
  // 切换 tab 时隐藏下拉菜单
  closeSort()
  // 如果筛选栏已置顶，保持置顶位置；否则滚动到顶部
  if (isFilterSticky.value) {
    uni.pageScrollTo({
      scrollTop: filterStickyScrollTop.value,
      duration: 0,
    })
  }
  loadRecommendList()
}

function refreshPage() {
  loadBanners()
  loadRecommendList()
}

onMounted(() => {
  refreshPage()
})

onShow(() => {
  pageScrollStore.setToTopBottom('72rpx')
  setTimeout(() => {
    if (uni.getStorageSync('needRefreshFromException') === '1') {
      uni.removeStorageSync('needRefreshFromException')
      refreshPage()
    }
  }, 100)
})

// 隐藏排序下拉
function closeSort() {
  if (isSortOpen.value) {
    isSortOpen.value = false
  }
}

onHide(() => {
  closeSort()
})

async function loadRecommendList(loadMore = false) {
  if (loadMore && !hasMore.value)
    return

  isLoading.value = true
  // 重置图片加载状态
  isWaterfallImagesLoaded.value = false
  try {
    const params = {
      pageSize: 20,
      sortType: (currentSort.value === '热门' ? 'hot' : 'latest') as 'hot' | 'latest',
      category: categoryFilter.currentTabId.value ? Number(categoryFilter.currentTabId.value) : undefined,
      fileType: categoryFilter.currentSubTabId.value ? Number(categoryFilter.currentSubTabId.value) : undefined,
      ...(loadMore ? { id: nextCursorId.value, hotScore: nextCursorScore.value } : {}),
    }
    const data = await getRecommendList<RecommendItem>(params)

    if (loadMore) {
      waterfallData.value = [...waterfallData.value, ...data.records]
    }
    else {
      waterfallData.value = data.records
    }

    nextCursorId.value = data.nextCursorId || 0
    nextCursorScore.value = data.nextCursorScore || 0
    hasMore.value = data.hasNext
  }
  catch (error) {
    console.error('获取推荐列表失败:', error)
  }
  finally {
    isLoading.value = false
  }
}

function toggleSort() {
  isSortOpen.value = !isSortOpen.value
}

function selectSort(option: string) {
  currentSort.value = option
  isSortOpen.value = false
  // 如果筛选栏已置顶，保持置顶位置；否则滚动到顶部
  if (isFilterSticky.value) {
    uni.pageScrollTo({
      scrollTop: filterStickyScrollTop.value,
      duration: 0,
    })
  }
  loadRecommendList()
}

onPageScroll((e) => {
  headerScrollTop.value = e.scrollTop ?? 0
  // 页面滚动时隐藏下拉菜单
  if (isSortOpen.value) {
    isSortOpen.value = false
  }
  // 计算筛选栏是否已置顶
  // Banner高度 686rpx + 搜索区域高度 108rpx - 重叠 160rpx - 状态栏高度
  const filterBarTop = uni.upx2px(686 + 108 - 160) - statusNavTotalHeight
  isFilterSticky.value = (e.scrollTop ?? 0) >= filterBarTop
  if (isFilterSticky.value) {
    filterStickyScrollTop.value = filterBarTop
  }
})

// 触底加载更多
onReachBottom(() => {
  loadRecommendList(true)
})

// 搜索
async function onSearch() {
  // 输入校验
  let keyWord = keyword.value.trim()
  if (!keyWord) {
    showCustomToast({
      title: '请输入搜索内容',
      icon: 'none',
    })
    return
  }
  keyWord = getSearchKeywordParam(keyword.value)

  try {
    const result = await homeSearch({ keyword: keyWord })
    // 根据页面类型跳转
    if (result.pageType === 1) {
      // 跳转到创作者主页
      uni.navigateTo({
        url: `/pages/creatorDetails/index?id=${result.memberId}`,
      })
    }
    else if (result.pageType === 2) {
      // 跳转到合集页面（从搜索跳转，不展示底部switchTab）
      const title = encodeURIComponent(result.collectionName || '')
      uni.navigateTo({
        url: `/pages/homeSearchCodeDetails/index?id=${result.collectionId}&title=${title}`,
      })
    }
  }
  catch (error) {
    // console.error('搜索失败:', error)
    // toast.error('搜索失败，请稍后重试')
  }
}

// 跳转到系列详情页
function goToSeriesDetail(seriesId: string | undefined) {
  if (!seriesId) {
    console.warn('Banner缺少seriesId')
    return
  }
  uni.navigateTo({
    url: `/pages/ipSeriesDetails/index?seriesId=${seriesId}`,
  })
}

// 处理瀑布流item点击
function handleWaterfallItemClick(item: any, index: number, detail: any) {
  // 设置入口来源
  worksDetailsStore.setEntrySource('home')
  // 设置当前item，如果有详情数据也一并传入
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
  loadRecommendList()
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

  // 添加后100条（如果存在）
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

// 下拉刷新
const isRefreshing = ref(false)
// 标记是否需要在下拉刷新完成后显示提示
const showRefreshToastAfterLoad = ref(false)

onPullDownRefresh(async () => {
  if (isRefreshing.value)
    return
  isRefreshing.value = true
  showRefreshToastAfterLoad.value = false
  try {
    // 重置分页状态
    nextCursorId.value = 0
    nextCursorScore.value = 0
    hasMore.value = true
    waterfallData.value = []
    // 重置一级和二级分类
    categoryFilter.resetAll()
    // 重置瀑布流图片加载状态
    isWaterfallImagesLoaded.value = false

    await Promise.all([
      loadBanners(),
      loadRecommendList(),
    ])
    // 标记需要在图片加载完成后显示提示
    showRefreshToastAfterLoad.value = true
  }
  catch {
    showCustomToast({ title: '刷新失败', icon: 'none', duration: 1500 })
    uni.stopPullDownRefresh()
    isRefreshing.value = false
  }
})

// 监听瀑布流图片全部加载完成
watch(isWaterfallImagesLoaded, (loaded) => {
  if (loaded && showRefreshToastAfterLoad.value) {
    showRefreshToastAfterLoad.value = false
    showCustomToast({ title: '刷新成功', icon: 'none', duration: 1500 })
    uni.stopPullDownRefresh()
    isRefreshing.value = false
  }
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

function goToSlimePage() {
  uni.navigateTo({
    url: '/pages/slime/index',
  })
}
</script>

<template>
  <view class="min-h-screen bg-[#f5f5f5]">
    <CommonHeader mode="fixed" :scroll-top="headerScrollTop" />
    <view class="relative h-686rpx w-full overflow-hidden">
      <swiper
        class="h-full w-full"
        autoplay
        circular
        @change="onBannerSwiperChange"
      >
        <swiper-item
          v-for="(banner, index) in banners.length > 0 ? banners : [{ miniProBannerImgUrl: getImgUrl('/assets/mp/temp/index_bg2.png'), seriesId: '' }]" :key="index"
          @click="goToSeriesDetail(banner.seriesId)"
        >
          <image class="h-full w-full" :src="banner.miniProBannerImgUrl" mode="scaleToFill" />
        </swiper-item>
      </swiper>
      <!-- 自定义指示点 -->
      <swiper-dynamic-bullets
        v-if="banners.length > 1"
        :resdata="banners"
        :current-index="bannerSwiperCurrent"
        dot-distance="32"
      />
      <image
        src="/static/images/banner_mark.png"
        class="absolute bottom-34rpx left-0 w-full"
        mode="widthFix"
      />
    </view>
    <view class="relative top-[-160rpx] z-10 mx-auto h-full w-full center">
      <view
        class="h-[104rpx] w-[686rpx] flex items-center border-[4rpx] border-[#333] rounded-full border-solid bg-white"
      >
        <image
          src="/src/static/images/ic_search.png"
          mode="scaleToFill"
          class="ml-[24rpx] h-40rpx w-40rpx"
        />
        <input
          id="home-search-input-debug"
          v-model="keyword"
          class="h-full flex-1 pl-[20rpx] pr-[30rpx] text-[32rpx] text-[#333]"
          type="text"
          confirm-type="search"
          placeholder="请输入创作者ID/口令"
          placeholder-style="color:#999;font-size:32rpx;"
          @confirm="onSearch"
        >
        <view
          v-if="keyword"
          class="mr-[12rpx] h-48rpx w-48rpx flex items-center justify-center"
          @click="keyword = ''"
        >
          <image
            src="/static/images/ic_clear.png"
            class="h-32rpx w-32rpx"
          />
        </view>
        <view
          class="mr-8rpx h-88rpx w-128rpx rounded-full bg-[#333] text-center text-[32rpx] text-[#fff] font-bold line-height-[88rpx]"
          @click="onSearch"
        >
          搜索
        </view>
      </view>
    </view>

    <!-- 功能区与瀑布流 -->
    <view class="relative top-[-160rpx] z-10 mx-auto w-full">
      <!-- 筛选栏 -->
      <view
        class="sticky z-30 bg-[#fff] pb-2 pl-10rpx pr-30rpx pt-20rpx"
        :style="{ top: `${statusNavTotalHeight}px` }"
      >
        <view class="flex items-center justify-between">
          <!-- 左侧 Tabs -->
          <u-tabs
            :list="categoryFilter.tabs.value"
            :is-scroll="true"
            item-width="100"
            gutter="0"
            active-color="#181818"
            :font-size="32"
            inactive-color="#999"
            :current="categoryFilter.currentTabIndex.value"
            @change="handleTabClick"
          />

          <!-- 右侧排序 -->
          <view class="relative shrink-0">
            <view class="center" @click="toggleSort">
              <i class="iconfont icon-a-shuxingpaixu01zhuangtaioff mr-1 text-28rpx" />
              <span class="text-28rpx">
                {{ currentSort }}
              </span>
            </view>

            <!-- 下拉菜单 -->
            <view
              class="absolute right-0 top-8 z-20 w-286rpx origin-top-right overflow-hidden rounded-md bg-white transition-all duration-200 ease-out"
              :class="isSortOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'"
              style="box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);"
            >
              <view
                v-for="(option, index) in sortOptions" :key="option"
                class="relative flex items-center justify-between px-4 py-2 text-sm active:bg-gray-100" :class="[
                  currentSort === option ? 'text-black font-bold' : 'text-gray-500',
                ]" @click="selectSort(option)"
              >
                <span>{{ option }}</span>
                <!-- 一个只有选项激活时才有的打勾图标 -->
                <view v-if="currentSort === option" class="i-carbon-checkmark text-24rpx text-[#181818]" />
                <!-- 贯穿横线 -->
                <view v-if="index !== sortOptions.length - 1" class="absolute bottom-0 left-0 right-0 h-1rpx bg-[rgba(102,102,102,0.1)]" />
              </view>
            </view>
          </view>
        </view>

        <!-- 二级分类 -->
        <view v-if="categoryFilter.hasSubTabs.value" class="mt-2 flex items-center gap-2 pl-12rpx">
          <view
            v-for="(tab, index) in categoryFilter.subTabs.value" :key="tab.id"
            class="box-border flex shrink-0 items-center justify-center rounded-full px-24rpx py-16rpx text-[24rpx] transition-all duration-200"
            :class="categoryFilter.currentSubTabIndex.value === index ? 'bg-primary text-white font-medium' : 'text-[#999] bg-[#F5F5F5]'"
            @click="handleSubTabClick(index)"
          >
            <text class="block leading-none">{{ tab.name }}</text>
          </view>
        </view>
      </view>
      <!-- 渐变模块 -->
      <view class="pointer-events-none sticky left-0 w-full" :style="{ top: `${statusNavTotalHeight + upx2px(168)}px` }" style="height: 80rpx; background: linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0));" />
      <!-- 瀑布流容器：设置最小高度确保空状态时撑满屏幕 -->
      <view class="relative top-[-60rpx] z-1" :style="homeListSectionMinStyle">
        <view v-if="waterfallData.length > 0">
          <FgWaterfall
            :list="waterfallData"
            :has-top-label="false"
            :has-type-label="false"
            :has-bottom-info="false"
            scene="1"
            @item-click="handleWaterfallItemClick"
            @asset-invalid="handleAssetInvalid"
            @all-images-loaded="isWaterfallImagesLoaded = true"
          />
          <!-- 底部提示：有数据、没有下一页、且图片全部加载完成时显示 -->
          <view v-if="!hasMore && !isLoading && isWaterfallImagesLoaded" class="py-40rpx text-center text-24rpx text-gray-400">
            - 到底了 -
          </view>
        </view>
        <fg-empty v-if="waterfallData.length === 0 && !isLoading" :full-height="false" />
      </view>
    </view>

    <!-- 史莱姆解压空间悬浮入口 -->
    <view 
      class="fixed bottom-[180rpx] right-4 z-40 w-16 h-16 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 flex flex-col items-center justify-center shadow-2xl active:scale-90 transition-transform animate-bounce border border-[rgba(255,255,255,0.2)]"
      style="box-shadow: 0 8px 24px rgba(124, 58, 237, 0.4); animation-duration: 2.8s;"
      @click="goToSlimePage"
    >
      <text class="text-2xl leading-none mt-1">🟢</text>
      <text class="text-[16rpx] font-bold text-white tracking-wider mt-[4rpx] leading-none">捏史莱姆</text>
      <view class="absolute -top-1 -right-1 px-1.5 py-0.5 bg-red-500 text-[14rpx] text-white rounded-full font-bold scale-75 leading-none shadow-md">解压</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
</style>
