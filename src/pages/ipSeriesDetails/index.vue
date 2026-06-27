<script lang="ts" setup>
import type { IpAssetItem, IpSeriesDetail, IpSimpleInfo } from '@/api/ip/ip'
import { onHide, onLoad, onPullDownRefresh, onReachBottom, onShareAppMessage, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { ConsumptionEntityType } from '@/api/common/index'
import { addCollect, cancelCollect, checkCollect, getIps, getIpSeriesDetailById } from '@/api/ip/ip'
import { useConsumptionSession } from '@/composables/useConsumptionSession'
import { showCustomToast } from '@/composables/useCustomToast'
import { getListSectionMinHeightStyle } from '@/constants/listSectionLayout'
import { usePageScrollBridge } from '@/hooks/usePageScrollBridge'
import { usePageScrollStore } from '@/store/pageScroll'
import { useTokenStore } from '@/store/token'
import { getImgUrl } from '@/utils'
import { menuButtonInfo, statusNavTotalHeight, systemInfo } from '@/utils/systemInfo'

const tokenStore = useTokenStore()
const pageScrollStore = usePageScrollStore()
usePageScrollBridge()

definePage({
  style: {
    navigationBarTitleText: '',
    enablePullDownRefresh: true,
  },
})

// 系列ID
const seriesId = ref('')

// 系列详情数据
const seriesDetail = ref<IpSeriesDetail | null>(null)

// 头部操作按钮的right定位
const headerButtonsRight = computed(() => {
  // #ifdef MP-TOUTIAO
  return `${systemInfo.windowWidth - menuButtonInfo.left + 10 + 60}px`
  // #endif
  // #ifndef MP-TOUTIAO
  return `${systemInfo.windowWidth - menuButtonInfo.left + 10}px`
  // #endif
})

// 收藏状态
const isCollected = ref(false)
const collectId = ref<number>(0)
const ipError = ref('')

// 顶部Banner列表（视频优先，然后是图片）
const bannerList = computed(() => {
  const result: { type: 'video' | 'image', url: string, poster?: string }[] = []

  // 如果有视频URL，放在第一位
  if (seriesDetail.value?.topPreVideoUrl) {
    result.push({
      type: 'video',
      url: seriesDetail.value.topPreVideoUrl,
      poster: seriesDetail.value.topPreImgUrl,
    })
  }

  // 添加图片URL
  if (seriesDetail.value?.topBannerImgUrls) {
    const images = seriesDetail.value.topBannerImgUrls.split(',').map(url => ({
      type: 'image' as const,
      url: url.trim(),
      poster: undefined,
    }))
    result.push(...images)
  }

  // 如果没有任何数据，返回默认背景图
  if (result.length === 0) {
    return [{
      type: 'image' as const,
      url: '',
      poster: undefined,
    }]
  }

  return result
})

const tabs = ([
  { name: '详情' },
  { name: '图库' },
])
const currentTab = ref(0)

// IP介绍轮播图数据（从ipSimpleList获取）
const ipIntroList = computed(() => {
  return seriesDetail.value?.ipSimpleList || []
})
const currentIpIndex = ref(0)

const currentBannerIndex = ref(0)
const headerScrollTop = ref(0)
const isFilterSticky = ref(false)
const filterStickyScrollTop = ref(0)
const videoContexts = ref<any[]>([])
const videoPlayingFlags = ref<boolean[]>([])

const IP_SERIES_STICKY_HEIGHT_RPX = 100
const ipSeriesContentMinStyle = getListSectionMinHeightStyle({ stickyHeightRpx: IP_SERIES_STICKY_HEIGHT_RPX })

function onBannerChange(e: any) {
  const newIndex = e.detail.current
  if (newIndex !== currentBannerIndex.value) {
    pauseAllVideos()
  }
  currentBannerIndex.value = newIndex
}

const bannerBgUrl = computed(() => {
  const activeBanner = bannerList.value[currentBannerIndex.value]
  if (activeBanner?.type === 'video' && activeBanner.poster) {
    return activeBanner.poster
  }
  return getImgUrl('/assets/mp/temp/index_bg2.png')
})

// watch(headerScrollTop, (newVal) => {
//   if (newVal >= 343) {
//     pauseAllVideos()
//   }
// })

function pauseAllVideos() {
  videoContexts.value.forEach((ctx, index) => {
    if (ctx && videoPlayingFlags.value[index]) {
      ctx.pause()
    }
  })
}

function onVideoPlay(index: number) {
  videoPlayingFlags.value[index] = true
}

function onVideoPause(index: number) {
  videoPlayingFlags.value[index] = false
}

// 当前选中的IP数据
const currentIpData = computed<IpSimpleInfo | null>(() => {
  const list = ipIntroList.value
  if (list.length === 0 || currentIpIndex.value >= list.length) {
    return null
  }
  return list[currentIpIndex.value]
})

// 图库列表数据
const ipGalleryList = ref<IpAssetItem[]>([])
const hasMoreGallery = ref(false)
const galleryNextCursorId = ref('')
const galleryNextCursorScore = ref('')

// 加载状态
const isLoading = ref(false)

// 转换图库数据为组件需要的格式
const galleryListFormatted = computed(() => {
  return ipGalleryList.value.map(item => ({
    id: item.id,
    name: item.name,
    count: Number(item.assetTotal) || 0,
    countFormatted: item.assetTotalFormatted,
    engageCount: item.totalInteractionFormatted || '',
    popCount: item.popularityStr || '',
    bg: item.desImgUrl || '',
    mainImg: item.mainImgUrl || '',
    avatarImgUrl: item.avatarImgUrl || '',
    images: item.previewAssets
      ? item.previewAssets.map(asset => asset.thumbUrl)
      : [],
  }))
})

function handleTabClick(index: number) {
  currentTab.value = index
  if (isFilterSticky.value) {
    uni.pageScrollTo({
      scrollTop: filterStickyScrollTop.value,
      duration: 0,
    })
  }
  // 切换到图库tab时加载数据
  if (index === 1 && ipGalleryList.value.length === 0) {
    loadIpGallery()
  }
}

onMounted(() => {
  nextTick(() => {
    bannerList.value.forEach((_, index) => {
      const ctx = uni.createVideoContext(`banner-video-${index}`)
      videoContexts.value.push(ctx)
      videoPlayingFlags.value.push(false)
    })
  })
})

onPageScroll((e) => {
  headerScrollTop.value = e.scrollTop ?? 0
  const filterBarTop = uni.upx2px(686) - statusNavTotalHeight
  isFilterSticky.value = (e.scrollTop ?? 0) >= filterBarTop
  if (isFilterSticky.value) {
    pauseAllVideos()
    filterStickyScrollTop.value = filterBarTop
  }
})

const isOffline = ref(false)

const isConsumptionSessionValid = computed(() => !isOffline.value && !!seriesId.value)
const {
  initSessionOnLoad,
  tryStartSession,
  reportReachBottomComplete,
  pauseSession,
  resumeSession,
  destroySession,
} = useConsumptionSession(ConsumptionEntityType.IP_SERIES, seriesId, isConsumptionSessionValid)

const pageRequestOptions = { hideLoading: true as const }

// 加载系列详情
async function loadSeriesDetail(id: string) {
  try {
    const res = await getIpSeriesDetailById({ seriesId: id }, pageRequestOptions)
    seriesDetail.value = res
    // 上报查看操作
    // if (tokenStore.hasLogin) {
    //   statsAction({
    //     entityType: 'IP_SERIES',
    //     contentId: id,
    //     actionType: 'VIEW',
    //   })
    // }
    isOffline.value = false
    tryStartSession()
    return true
  }
  catch (error: any) {
    console.error('获取系列详情失败:', error)
    if (error) {
      isOffline.value = true

      // 提取错误信息并去除前缀
      let errMsg = error?.data?.message || error?.data?.msg || error?.message || error?.msg || (typeof error === 'string' ? error : '')
      if (typeof errMsg === 'string' && errMsg.startsWith('Error: ')) {
        errMsg = errMsg.replace('Error: ', '')
      }
      ipError.value = errMsg
    }
    return false
  }
}

// 加载图库数据
async function loadIpGallery(isRefresh = false) {
  if (!seriesId.value)
    return false

  isLoading.value = true
  try {
    // 刷新时重置分页状态
    if (isRefresh) {
      ipGalleryList.value = []
      galleryNextCursorId.value = ''
      galleryNextCursorScore.value = ''
      hasMoreGallery.value = true
    }

    const params: {
      seriesId: string
      pageSize: number
      cursorId?: string
      interactionScore?: number
    } = {
      seriesId: seriesId.value,
      pageSize: 10,
    }

    if (galleryNextCursorId.value) {
      params.cursorId = galleryNextCursorId.value
      params.interactionScore = Number(galleryNextCursorScore.value) || 0
    }

    const data = await getIps(params, pageRequestOptions)
    if (isRefresh) {
      ipGalleryList.value = data.records
    }
    else {
      ipGalleryList.value = [...ipGalleryList.value, ...data.records]
    }
    hasMoreGallery.value = data.hasNext
    galleryNextCursorId.value = data.nextCursorId
    galleryNextCursorScore.value = data.nextCursorScore
    return true
  }
  catch (error) {
    console.error('加载图库数据失败:', error)
    return false
  }
  finally {
    isLoading.value = false
  }
}

function onSwiperChange(e: any) {
  currentIpIndex.value = e.detail.current
}

// 检查收藏状态
async function checkCollectStatus() {
  if (!seriesId.value)
    return false
  try {
    const result = await checkCollect({
      entityType: 5,
      entityId: seriesId.value,
    }, pageRequestOptions)
    isCollected.value = result.isCollected
    collectId.value = result.id
    return true
  }
  catch (error) {
    console.error('检查收藏状态失败:', error)
    return false
  }
}

// 处理收藏/取消收藏
async function handleCollect() {
  if (!seriesId.value)
    return
  try {
    if (isCollected.value) {
      // 已收藏，调用取消收藏
      await cancelCollect({ collectId: collectId.value })
      isCollected.value = false
      showCustomToast({ title: '已取消收藏', icon: 'success' })
    }
    else {
      // 未收藏，调用添加收藏
      const result = await addCollect({
        entityType: 5,
        entityId: seriesId.value,
      })
      isCollected.value = true
      collectId.value = result as number
      showCustomToast({ title: '收藏成功', icon: 'success' })
    }
  }
  catch (error) {
    console.error('收藏操作失败:', error)
  }
}

// 页面加载时获取参数并加载数据
onLoad(async (options) => {
  if (options?.seriesId) {
    seriesId.value = options.seriesId
    initSessionOnLoad()

    uni.showLoading({ title: '加载中', mask: true })
    try {
      await Promise.all([
        loadSeriesDetail(options.seriesId),
        checkCollectStatus(),
      ])
    }
    finally {
      uni.hideLoading()
    }
  }
})

// 触底加载更多
onReachBottom(() => {
  // 仅详情 Tab 的触底参与消费完成记录/上报
  if (currentTab.value === 0) {
    reportReachBottomComplete()
  }
  // 只有在图库tab且有更多数据时才加载
  if (currentTab.value === 1 && hasMoreGallery.value && !isLoading.value) {
    loadIpGallery()
  }
})

onHide(() => {
  pauseSession()
})

onUnload(() => {
  destroySession()
})

function handleClick(item: any) {
  const title = encodeURIComponent(item.name || seriesDetail.value?.name || '')
  uni.navigateTo({ url: `/pages/ipCollectionDetails/index?id=${item.id}&seriesId=${seriesId.value}&title=${title}` })
}

// 下拉刷新
const isRefreshing = ref(false)
onPullDownRefresh(async () => {
  if (isRefreshing.value)
    return
  isRefreshing.value = true
  try {
    // 重置数据状态
    seriesDetail.value = null
    isCollected.value = false
    collectId.value = 0
    isOffline.value = false
    ipError.value = ''

    const results = await Promise.all([
      loadSeriesDetail(seriesId.value),
      checkCollectStatus(),
      currentTab.value === 1 ? loadIpGallery(true) : Promise.resolve(true),
    ])
    const allSuccess = results.every(result => result === true)
    if (allSuccess) {
      showCustomToast({ title: '刷新成功', icon: 'none', duration: 1000 })
    }
    else {
      showCustomToast({ title: '刷新失败', icon: 'none', duration: 1000 })
    }
  }
  catch {
    showCustomToast({ title: '刷新失败', icon: 'none', duration: 1000 })
  }
  finally {
    uni.stopPullDownRefresh()
    isRefreshing.value = false
  }
})

// 保留筛选条件刷新页面数据
async function refreshPageByFilter() {
  if (!seriesId.value)
    return

  uni.showLoading({ title: '加载中', mask: true })
  try {
    await Promise.all([
      loadSeriesDetail(seriesId.value),
      checkCollectStatus(),
      currentTab.value === 1 ? loadIpGallery(true) : Promise.resolve(true),
    ])
  }
  finally {
    uni.hideLoading()
  }
}

onShow(() => {
  resumeSession()
  pageScrollStore.setToTopBottom('72rpx')
  setTimeout(() => {
    if (uni.getStorageSync('needRefreshFromException') === '1') {
      uni.removeStorageSync('needRefreshFromException')
      // 重置数据状态
      seriesDetail.value = null
      isCollected.value = false
      collectId.value = 0
      ipError.value = ''
      ipGalleryList.value = []
      refreshPageByFilter()
    }
  }, 100)
})

// 分享上报函数
// function reportShare() {
//   if (tokenStore.hasLogin) {
//     statsAction({
//       entityType: 'IP_SERIES',
//       contentId: seriesId.value || '',
//       actionType: 'SHARE',
//     })
//   }
// }

// 分享功能
onShareAppMessage(() => {
  const shareTitle = seriesDetail.value?.name
    ? `${seriesDetail.value.name} - IP系列`
    : 'IP系列详情'
  let shareImage = ''
  // #ifdef MP-TOUTIAO
  shareImage = getImgUrl('/assets/mp/temp/tt_share.png')
  // #endif
  // #ifdef MP-WEIXIN
  shareImage = getImgUrl('/assets/mp/temp/wx_share.png')
  // #endif
  // #ifndef MP-TOUTIAO || MP-WEIXIN
  shareImage = seriesDetail.value?.topBannerImgUrls
    ? seriesDetail.value.topBannerImgUrls.split(',')[0]
    : ''
  // #endif
  const sharePath = `/pages/ipSeriesDetails/index?seriesId=${seriesId.value || ''}`

  // #ifdef MP-WEIXIN
  // 微信小程序：立即上报（微信小程序 success 回调不可靠）
  // reportShare()
  // #endif

  return {
    title: shareTitle,
    path: sharePath,
    imageUrl: shareImage,
    // #ifdef MP-TOUTIAO
    // 抖音小程序：使用 success 回调上报
    // success: () => {
    //   reportShare()
    // },
    // #endif
  }
})
</script>

<template>
  <view class="h-screen flex flex-col bg-[#fff]">
    <!-- headerScrollTop -->
    <CommonHeader mode="fixed" :scroll-top="bannerList[currentBannerIndex]?.type !== 'video' ? headerScrollTop : 0" />

    <!-- 系列已下架展示空状态 -->
    <template v-if="isOffline">
      <fg-empty type="content" :text="ipError" class="flex-1" />
      <view
        class="fixed z-[999] h-64rpx w-64rpx flex items-center justify-center border-[1rpx] border-[#666]/10 rounded-full border-solid bg-white/70"
        :style="{
          top: `${menuButtonInfo.top}px`,
          right: headerButtonsRight,
        }"
        @click="handleCollect"
      >
        <i v-if="isCollected" class="iconfont icon-a-shuxingxianxingmingchengshoucangzhuangtaion text-40rpx text-[#fec460]" />
        <i v-else class="iconfont icon-a-shuxingxianxingmingchengshoucangzhuangtaioff text-40rpx text-[#333]" />
      </view>
    </template>

    <!-- 正常渲染详情内容 -->
    <template v-else>
      <!-- 头部右上角操作按钮 -->
      <view
        class="fixed z-[999] flex items-center gap-20rpx"
        :style="{
          top: `${menuButtonInfo.top}px`,
          height: `${menuButtonInfo.height}px`,
          right: headerButtonsRight,
        }"
      >
        <!-- 收藏 -->
        <view class="h-64rpx w-64rpx flex items-center justify-center border-[1rpx] border-[#666]/10 rounded-full border-solid bg-white/70" @click="handleCollect">
          <i v-if="isCollected" class="iconfont icon-a-shuxingxianxingmingchengshoucangzhuangtaion text-40rpx text-[#fec460]" />
          <i v-else class="iconfont icon-a-shuxingxianxingmingchengshoucangzhuangtaioff text-40rpx text-[#333]" />
        </view>
        <!-- 分享 -->
        <view class="relative h-64rpx w-64rpx flex items-center justify-center border-[1rpx] border-[#666]/10 rounded-full border-solid bg-white/70">
          <i class="iconfont icon-a-shuxingxianxingmingchengfenxiangzhuangtaioff text-40rpx text-[#333]" />
          <button open-type="share" class="absolute inset-0 h-full w-full border-none bg-transparent opacity-0" style="padding: 0; margin: 0; border: none; background: transparent;" />
        </view>
      </view>

      <!-- 固定顶部区域 -->
      <view v-if="bannerList[currentBannerIndex]?.type === 'video'" class="fixed left-0 top-0 z-5 w-full overflow-hidden" :style="{ height: `${statusNavTotalHeight + 16}px` }">
        <image
          class="h-full w-full" :src="bannerBgUrl"
          mode="widthFix"
        />
      </view>

      <view class="relative h-[686rpx] w-full flex-shrink-0">
        <image
          v-if="bannerList[currentBannerIndex]?.type === 'video'"
          class="absolute left-0 top-0 z-0 h-full w-full"
          :src="bannerBgUrl"
          mode="scaleToFill"
        />
        <swiper
          id="banner-swiper"
          class="relative z-10 h-full w-full"
          :autoplay="false"
          circular
          @change="onBannerChange"
        >
          <swiper-item v-for="(banner, index) in bannerList" :key="index">
            <video
              v-if="banner.type === 'video'"
              :id="`banner-video-${index}`"
              class="absolute left-1/2 z-20 h-[394rpx] w-[702rpx] rounded-24rpx -translate-x-1/2"
              :style="{ bottom: '92rpx' }"
              :src="banner.url"
              :autoplay="false"
              :show-mute-btn="true"
              loop
              object-fit="contain"
              @play="onVideoPlay(index)"
              @pause="onVideoPause(index)"
            />
            <ImagePlaceholder
              v-else class-name="h-full w-full" :src="banner.url" mode="scaleToFill"
            />
          </swiper-item>
        </swiper>
        <!-- 自定义指示点 -->
        <swiper-dynamic-bullets
          v-if="bannerList.length > 1"
          :resdata="bannerList"
          :current-index="currentBannerIndex"
          dot-distance="32"
        />
      </view>

      <!-- 功能区与瀑布流 -->
      <view class="relative top-[-40rpx] mx-auto w-full flex flex-1 flex-col">
        <!-- 筛选栏 -->
        <view
          class="sticky z-30 mb-2 flex flex-shrink-0 items-center justify-between overflow-hidden rounded-t-[32rpx] bg-[#fff] pb-2 pl-10rpx pr-30rpx"
          :style="{ top: `${statusNavTotalHeight}px` }"
        >
          <!-- Tabs -->
          <u-tabs :list="tabs" :is-scroll="false" item-width="100" active-color="#181818" inactive-color="#999" :current="currentTab" @change="handleTabClick" />
        </view>

        <!-- 渐变遮罩层 - 用height:0的sticky容器实现不占位又贴在顶部 -->
        <view v-show="currentTab === 1" class="pointer-events-none sticky left-0 w-full" :style="{ height: '0', top: `${statusNavTotalHeight + 54}px` }">
          <view class="w-full" :style="{ height: '80rpx', background: 'linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0))' }" />
        </view>

        <!-- 详情内容区域 -->
        <view v-if="currentTab === 0" class="box-border w-full flex-1 bg-[#fff] pb-40rpx" :style="ipSeriesContentMinStyle">
          <!-- 第一行：IP系列名称 -->
          <view class="mb-20rpx px-30rpx text-36rpx text-main font-bold">
            {{ seriesDetail?.name }}
          </view>

          <!-- 第二行：人气值和互动量 -->
          <view class="mb-30rpx inline-flex items-center gap-20rpx px-30rpx">
            <view class="inline-flex items-center border border-[rgba(102,102,102,0.1)] rounded-8rpx border-solid bg-[#F5F5F5] px-[12rpx] py-[4rpx]">
              <text class="text-20rpx text-[#999] leading-[18px]">人气值：</text>
              <text class="ml-4rpx text-20rpx text-[#999] leading-[18px]">{{ seriesDetail?.popularityCountStr }}</text>
            </view>
            <view class="inline-flex items-center border border-[rgba(102,102,102,0.1)] rounded-8rpx border-solid bg-[#F5F5F5] px-[12rpx] py-[4rpx]">
              <text class="text-20rpx text-[#999] leading-[18px]">互动值：</text>
              <text class="ml-4rpx text-20rpx text-[#999] leading-[18px]">{{ seriesDetail?.engageCountStr }}</text>
            </view>
          </view>

          <!-- 第三行：简介 -->
          <view class="px-30rpx text-28rpx text-[#666] leading-relaxed">
            简介：{{ seriesDetail?.description }}
          </view>

          <!-- 分割线 -->
          <u-gap height="16" bg-color="#f5f5f5" margin-top="40" margin-bottom="40" />

          <!-- 第四行：IP介绍区域 -->
          <view class="flex flex-col items-center px-30rpx">
            <!-- 区域标题 -->
            <view class="mb-30rpx text-36rpx text-main font-bold">
              IP介绍
            </view>

            <!-- 轮播图容器 -->
            <view class="relative mb-40rpx">
              <!-- 轮播图 -->
              <swiper
                class="relative z-10 h-780rpx w-750rpx" :current="currentIpIndex" previous-margin="105rpx"
                next-margin="105rpx" :autoplay="false" :circular="true" @change="onSwiperChange"
              >
                <swiper-item v-for="(item, index) in ipIntroList" :key="item.id" class="flex items-center justify-center">
                  <view
                    class="relative h-742rpx w-540rpx overflow-hidden rounded-16rpx transition-all duration-300 ease"
                    :class="[index === currentIpIndex ? 'scale-100 opacity-100 z-10' : 'scale-81 opacity-80']"
                  >
                    <image :src="item.desImgUrl" mode="aspectFill" class="h-full w-full" lazy-load />
                  </view>
                </swiper-item>
              </swiper>
            </view>

            <!-- 轮播图下方内容 -->
            <view class="z-3 w-600rpx">
              <view class="mb-16rpx text-center text-36rpx text-main font-bold">
                {{ currentIpData?.name }}
              </view>
              <view class="mb-16rpx text-center text-28rpx text-main font-bold">
                {{ currentIpData?.slogan }}
              </view>
              <view class="text-left text-28rpx text-[#666] leading-relaxed">
                {{ currentIpData?.description }}
              </view>
            </view>

            <image
              src="/static/images/logo_mask.png"
              mode="widthFix"
              class="absolute bottom-[160rpx] left-0 w-full"
            />
          </view>
        </view>

        <!-- 图库内容区域 -->
        <view v-else class="box-border w-full flex flex-1 flex-col bg-[#f5f5f5] pb-40rpx" :style="ipSeriesContentMinStyle">
          <!-- 有数据时显示列表 -->
          <view v-if="galleryListFormatted.length > 0" class="flex-1">
            <ip-collection-list
              :list="galleryListFormatted" :has-more="hasMoreGallery" mode="ip"
              @handle-click="handleClick"
            />
            <!-- 底部提示：有数据、没有下一页、且不在加载中时显示 -->
            <view v-if="!hasMoreGallery && !isLoading" class="py-40rpx text-center text-24rpx text-gray-400">
              - 到底了 -
            </view>
          </view>
          <!-- 无数据时显示空状态 -->
          <fg-empty v-if="galleryListFormatted.length === 0 && !isLoading" type="content" class="flex-1" />
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
:deep(.dot-wrapper-box) {
  bottom: 60rpx;
  right: auto;
  left: 50%;
}
</style>
