<script lang="ts" setup>
import type { CreatorPublicInfo } from '@/api/me/me'
import { onHide, onLoad, onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { followOperate, getFollowRelation } from '@/api/common'
import {
  getCreatorAssetList,
  getCreatorCollectionList,
  getCreatorPublicInfo,
  getFollowStats,
} from '@/api/me/me'
import IpCollectionList from '@/components/ip-collection-list/ip-collection-list.vue'
import { useCategoryFilter } from '@/composables/useCategoryFilter'
import { showCustomToast } from '@/composables/useCustomToast'
import { getListSectionMinHeightStyle, getProfileCreatorTabFilterBarTopPx, PROFILE_STICKY_HEIGHT_RPX } from '@/constants/listSectionLayout'
import { usePageScrollBridge } from '@/hooks/usePageScrollBridge'
import { usePageScrollStore } from '@/store/pageScroll'
import { useUserStore } from '@/store/user'
import { useWorksDetailsStore } from '@/store/worksDetails'
import { getImgUrl } from '@/utils'
import { menuButtonInfo, statusNavTotalHeight, systemInfo } from '@/utils/systemInfo'

definePage({
  style: {
    navigationBarTitleText: '',
    enablePullDownRefresh: true,
  },
})

usePageScrollBridge()

const upx2px = (rpx: number) => uni.upx2px(rpx)

// 创作者信息
const creatorInfo = ref<CreatorPublicInfo | null>(null)

/** Banner 高度 */
const BANNER_HEIGHT_RPX = 160
/** Banner 吸附阈值：Header(686rpx) + Divider(20rpx) + mt-24rpx = 730rpx */
const BANNER_STICK_THRESHOLD_RPX = 730
/** Sticky Tab Bar 高度：官方帐号主Tab(84rpx) + 分类行(16rpx+16rpx+42rpx) = 158rpx，普通帐号主Tab(84rpx) + 分类行(16rpx+16rpx+48rpx) = 164rpx */
const STICKY_TAB_BAR_HEIGHT_RPX = computed(() => creatorInfo.value?.level === 4 ? 158 : 182)
/** Banner 吸附时 Header 展开状态 */
const isHeaderExpanded = ref(false)

const pageScrollStore = usePageScrollStore()
const creatorId = ref<number>(0)
const worksDetailsStore = useWorksDetailsStore()
const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)

/** 与首页一致：筛选栏（Tab 区）是否已吸顶、吸顶时 pageScrollTo 的目标 scrollTop */
const isFilterSticky = ref(false)
const filterStickyScrollTop = ref(0)

/** 列表区 min-height：100vh - 状态栏导航 - Tab sticky 区 */
const listSectionMinHeightStyle = computed(() => getListSectionMinHeightStyle({
  stickyHeightRpx: PROFILE_STICKY_HEIGHT_RPX,
  bottomReserveRpx: creatorInfo.value?.bannerUrl ? BANNER_HEIGHT_RPX : 0,
}))

onPageScroll((e) => {
  const st = e.scrollTop ?? 0
  pageScrollStore.setScrollTop(st)
  const filterBarTop = getProfileCreatorTabFilterBarTopPx(!!creatorInfo.value?.bannerUrl)
  isFilterSticky.value = st >= filterBarTop
  if (isFilterSticky.value)
    filterStickyScrollTop.value = filterBarTop
  // Banner 吸附时展开 Header 高度
  const bannerStickThresholdPx = uni.upx2px(BANNER_STICK_THRESHOLD_RPX)
  isHeaderExpanded.value = st >= bannerStickThresholdPx
})

const isMe = computed(() => creatorInfo.value?.id === userInfo.value?.id)

// 关注粉丝数
const followStats = ref({ fansCountStr: '0', followedCountStr: '0' })

// 获赞与收藏弹窗
const showLikesFavoritesPopup = ref(false)

// 是否已关注
const isFollowed = ref(false)
const showCancelFollowPopup = ref(false)

// 个人简介展开状态
// 默认隐藏展开按钮，通过隐藏的 ghost 元素量出完整高度后再决定是否显示
const showBioExpandBtn = ref(false)
const isBioExpanded = ref(false)

// 第一行标签
const mainTabs = [{ name: '创作' }]
const currentMainTab = ref(0)

// 使用 composable 管理一级和二级分类（跟随变更）
const categoryFilter = useCategoryFilter({
  enableSubTabSync: false,
})

// 第二行标签
const currentSubTabName = ref('全部')
const currentSubTabId = ref<string | number>('')

const collectionList = ref<any[]>([])
const waterfallData = ref<any[]>([])

const subTabs = computed(() => {
  return collectionList.value.length > 0
    ? [{ id: 'collection', name: '合集' }, ...categoryFilter.tabs.value]
    : categoryFilter.tabs.value
})

const currentSubTab = computed(() => {
  const idx = subTabs.value.findIndex(t => t.name === currentSubTabName.value)
  return idx === -1 ? 0 : idx
})

const hasFixedFirstSubTab = computed(() => {
  const first = subTabs.value[0]
  return subTabs.value.length > 1 && !!first && (first.id === 'collection' || first.id === 'ip-series')
})

const scrollableSubTabs = computed(() => {
  return hasFixedFirstSubTab.value ? subTabs.value.slice(1) : subTabs.value
})

const isShowCollection = computed(() => currentSubTabName.value === '合集')

// 排序筛选状态
const isSortOpen = ref(false)

// 排序筛选显示文本
const currentSortText = computed(() => {
  return categoryFilter.subTabDisplayText.value
})

// 瀑布流分页状态
const pageState = {
  nextCursorId: undefined as number | undefined,
  nextCursorScore: undefined as number | undefined,
  nextCursorIsTop: undefined as number | undefined,
  hasNext: true,
  loading: false,
}
// 瀑布流图片是否全部加载完成
const isWaterfallImagesLoaded = ref(false)

// 获取创作者公开信息
async function fetchCreatorInfo() {
  if (!creatorId.value)
    return
  try {
    creatorInfo.value = await getCreatorPublicInfo(creatorId.value)
  }
  catch (error) {
    console.error('获取创作者信息失败', error)
  }
}

// 获取关注统计
async function fetchFollowStats() {
  try {
    const res = await getFollowStats(creatorId.value || undefined)
    followStats.value = {
      fansCountStr: res.fansCountStr || '0',
      followedCountStr: res.followedCountStr || '0',
    }
  }
  catch (error) {
    console.error('获取关注统计失败', error)
  }
}

// 获取关注关系
async function fetchFollowRelation() {
  if (!creatorId.value)
    return
  try {
    const res = await getFollowRelation({ followedMemberId: creatorId.value })
    isFollowed.value = res.isFollowed
  }
  catch (error) {
    console.error('获取关注关系失败', error)
  }
}

// 处理关注/取消关注
async function handleFollow() {
  if (!creatorId.value)
    return

  // 如果已关注，先弹出确认框
  if (isFollowed.value) {
    showCancelFollowPopup.value = true
    // uni.showModal({
    //   title: '提示',
    //   content: '确定要取消关注吗？',
    //   success: async (res) => {
    //     if (res.confirm) {
    //       await doFollowOperate(0)
    //     }
    //   },
    // })
    return
  }

  // 未关注，直接关注
  await doFollowOperate(1)
}

// 执行关注/取消关注操作
async function doFollowOperate(action: 0 | 1) {
  try {
    await followOperate({
      followedMemberId: creatorId.value,
      followAction: action,
    })
    showCustomToast({ title: action === 1 ? '关注成功' : '已取消关注', icon: 'success' })
    showCancelFollowPopup.value = false
    // 刷新关注关系和统计
    await fetchFollowRelation()
    fetchFollowStats()
  }
  catch (error) {
    console.error('关注操作失败:', error)
  }
}

// 获取公开合集列表
async function fetchCollectionList() {
  if (!creatorId.value)
    return
  try {
    const res = await getCreatorCollectionList(creatorId.value)
    collectionList.value = res.records.map(item => ({
      ...item,
      name: item.title,
      count: item.assetCount,
      countFormatted: item.assetCountFormatted,
      popCount: item.popularityStr,
      bg: item.coverUrl,
      images: item.topAssets?.map((a: any) => a.thumbUrl) || [],
    }))

    if (collectionList.value.length === 0 && currentSubTabName.value === '合集') {
      currentSubTabName.value = '全部'
    }
    else if (collectionList.value.length > 0 && currentSubTabName.value === '全部' && waterfallData.value.length === 0) {
      currentSubTabName.value = '合集'
    }
  }
  catch (error) {
    console.error('获取合集失败', error)
  }
}

// 获取创作者素材列表
async function fetchAssetList(isRefresh = false) {
  if (!creatorId.value)
    return
  if (pageState.loading || (!pageState.hasNext && !isRefresh))
    return
  pageState.loading = true

  if (isRefresh) {
    pageState.nextCursorId = undefined
    pageState.nextCursorScore = undefined
    pageState.nextCursorIsTop = undefined
    pageState.hasNext = true
  }
  // 重置图片加载状态
  isWaterfallImagesLoaded.value = false

  try {
    const categoryId = currentSubTabId.value || undefined
    const res = await getCreatorAssetList({
      creatorId: creatorId.value,
      pageSize: 20,
      cursorId: pageState.nextCursorId,
      sortOrder: pageState.nextCursorScore,
      cursorIsTop: pageState.nextCursorIsTop,
      category: categoryId as number,
      fileType: categoryFilter.currentSubTabId.value ? Number(categoryFilter.currentSubTabId.value) : undefined,
    })

    if (isRefresh) {
      waterfallData.value = res.records
    }
    else {
      waterfallData.value.push(...res.records)
    }

    pageState.nextCursorId = res.nextCursorId ?? undefined
    pageState.nextCursorScore = res.nextCursorScore ?? undefined
    pageState.nextCursorIsTop = res.nextCursorIsTop ?? undefined
    pageState.hasNext = res.hasNext
  }
  catch (error) {
    console.error('获取素材列表失败', error)
  }
  finally {
    pageState.loading = false
  }
}

onLoad((options) => {
  const id = options?.id || 0
  if (!id) {
    showCustomToast({ title: '创作者ID无效', icon: 'none' })
    uni.navigateBack()
    return
  }
  creatorId.value = id
})

onShow(() => {
  pageScrollStore.setToTopBottom('72rpx')
  fetchFollowStats()
  fetchFollowRelation()
  setTimeout(() => {
    if (uni.getStorageSync('needRefreshFromException') === '1') {
      uni.removeStorageSync('needRefreshFromException')
      fetchCreatorInfo()
    }
  }, 100)
})

// 页面隐藏时隐藏下拉菜单
onHide(() => {
  closeSort()
})

// 触底加载更多
onReachBottom(() => {
  if (isShowCollection.value)
    return
  fetchAssetList()
})

// 复制Kanoo号
function copyYuanqiId() {
  uni.setClipboardData({
    data: creatorInfo.value?.uniqueCode || '',
    success: () => {
      // 复制的toast必须用uni提供的，否则无法覆盖原生toast
      uni.showToast({ title: '已复制', icon: 'success' })
    },
    fail: () => uni.showToast({ title: '复制失败', icon: 'none' }),
  })
}

// 跳转二维码页面
function toQrcode() {
  uni.navigateTo({
    url: `/pages/me/qrcode?fromCreator=1&creatorId=${creatorId.value}`,
  })
}

// 头部操作按钮的right定位
const headerButtonsRight = computed(() => {
  // #ifdef MP-TOUTIAO
  return `${systemInfo.windowWidth - menuButtonInfo.left + 10 + 60}px`
  // #endif
  // #ifndef MP-TOUTIAO
  return `${systemInfo.windowWidth - menuButtonInfo.left + 10}px`
  // #endif
})

// 切换第二行标签
function handleSubTabClick(index: number) {
  const tab = subTabs.value[index]
  if (currentSubTabName.value === tab.name)
    return

  // 切换 tab 时隐藏下拉菜单
  closeSort()

  if (isFilterSticky.value) {
    uni.pageScrollTo({
      scrollTop: filterStickyScrollTop.value,
      duration: 0,
    })
  }
  currentSubTabName.value = tab.name
  currentSubTabId.value = tab.id

  // 更新 composable 中的一级分类
  if (tab.id !== 'collection') {
    categoryFilter.selectTab(tab.id as string)
  }

  if (tab.name !== '合集') {
    fetchAssetList(true)
  }
}

// 切换排序下拉
function toggleSort() {
  isSortOpen.value = !isSortOpen.value
}

// 隐藏排序下拉
function closeSort() {
  if (isSortOpen.value) {
    isSortOpen.value = false
  }
}

// 选择排序选项
function selectSort(optionId: string) {
  categoryFilter.selectSubTab(optionId)
  isSortOpen.value = false
  if (isFilterSticky.value) {
    uni.pageScrollTo({
      scrollTop: filterStickyScrollTop.value,
      duration: 0,
    })
  }
  fetchAssetList(true)
}

// 处理瀑布流item点击
function handleWaterfallItemClick(item: any, index: number, detail: any) {
  worksDetailsStore.setEntrySource('creator')
  worksDetailsStore.setCurrentItem(item, index, detail)

  // 构建tab列表：当前项 + 前100条 + 后100条
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
  const totalCount = waterfallData.value.length
  const result: any[] = []

  // 添加前100条（如果存在）
  const startIndex = Math.max(0, currentIndex - 100)
  for (let i = startIndex; i < currentIndex; i++) {
    const item = waterfallData.value[i]
    result.push({
      id: item.id || item.assetsId || item.contentId,
      thumbUrl: item.thumbUrl,
      staticThumbUrl: item.staticThumbUrl,
    })
  }

  // 添加当前项
  const currentItem = waterfallData.value[currentIndex]
  result.push({
    id: currentItem.id || currentItem.assetsId || currentItem.contentId,
    thumbUrl: currentItem.thumbUrl,
    staticThumbUrl: currentItem.staticThumbUrl,
  })

  // 添加后100条（如果存在）
  const endIndex = Math.min(totalCount, currentIndex + 101)
  for (let i = currentIndex + 1; i < endIndex; i++) {
    const item = waterfallData.value[i]
    result.push({
      id: item.id || item.assetsId || item.contentId,
      thumbUrl: item.thumbUrl,
      staticThumbUrl: item.staticThumbUrl,
    })
  }

  return result
}

function handleAssetInvalid() {
  fetchAssetList(true)
}

onMounted(() => {
  nextTick(async () => {
    await fetchCreatorInfo()
    await fetchCollectionList()
    fetchAssetList(true)
  })
})

// 监听简介变化以计算是否需要展示展开按钮
const bioCheckTimer = ref<ReturnType<typeof setTimeout> | null>(null)
function checkCreatorBioOverflow() {
  if (bioCheckTimer.value) {
    clearTimeout(bioCheckTimer.value)
  }
  bioCheckTimer.value = setTimeout(() => {
    const query = uni.createSelectorQuery()
    query
      .select('#creator-bio-text-hidden')
      .boundingClientRect((rectHidden: any) => {
        if (rectHidden) {
          const lineHeight = uni.upx2px(32)
          if (rectHidden.height > lineHeight + 2) {
            showBioExpandBtn.value = true
          }
          else {
            showBioExpandBtn.value = false
          }
        }
      })
      .exec()
  }, 200)
}

watch(() => creatorInfo.value?.bio, (newVal) => {
  isBioExpanded.value = false
  if (!newVal) {
    showBioExpandBtn.value = false
    return
  }
  nextTick(() => {
    checkCreatorBioOverflow()
  })
}, { immediate: true })

// 分享功能
onShareAppMessage(() => {
  const shareTitle = creatorInfo.value?.nickname
    ? `${creatorInfo.value.nickname}的主页`
    : '创作者主页'
  let shareImage = ''
  // #ifdef MP-TOUTIAO
  shareImage = getImgUrl('/assets/mp/temp/tt_share.png')
  // #endif
  // #ifdef MP-WEIXIN
  shareImage = getImgUrl('/assets/mp/temp/wx_share.png')
  // #endif
  // #ifndef MP-TOUTIAO || MP-WEIXIN
  shareImage = creatorInfo.value?.avatar || ''
  // #endif
  const sharePath = `/pages/creatorDetails/index?id=${creatorId.value || ''}`

  return {
    title: shareTitle,
    path: sharePath,
    imageUrl: shareImage,
  }
})

function handleClick(item: any) {
  // 普通帐号跳转collectionDetails  官方帐号跳转ipCollectionDetails
  if (creatorInfo.value?.level === 4)
    uni.navigateTo({ url: `/pages/ipCollectionDetails/index?id=${item.id}&fromCreator=1&title=${item.name}&creatorId=${creatorId.value}&creatorLevel=${creatorInfo.value?.level}` })
  else
    uni.navigateTo({ url: `/pages/collectionDetails/index?id=${item.id}&creatorId=${creatorId.value}` })
}

function goToSeriesDetail(id: string | number) {
  if (!id)
    return
  uni.navigateTo({ url: `/pages/ipSeriesDetails/index?seriesId=${id}` })
}
// 下拉刷新
const isRefreshing = ref(false)
onPullDownRefresh(async () => {
  if (isRefreshing.value)
    return
  isRefreshing.value = true
  try {
    // 重置数据状态
    collectionList.value = []
    waterfallData.value = []
    currentSubTabName.value = '全部'
    currentSubTabId.value = ''

    await Promise.all([
      fetchCreatorInfo(),
      fetchCollectionList(),
      fetchFollowStats(),
      fetchFollowRelation(),
      fetchAssetList(true),
    ])
    showCustomToast({ title: '刷新成功', icon: 'none', duration: 1000 })
  }
  catch {
    showCustomToast({ title: '刷新失败', icon: 'none', duration: 1000 })
  }
  finally {
    uni.stopPullDownRefresh()
    isRefreshing.value = false
  }
})
</script>

<template>
  <view class="relative min-h-screen flex flex-col bg-[#333333]">
    <CommonHeader mode="auto" :scroll-top="0" />
    <ConfirmPopup
      v-model:visible="showCancelFollowPopup"
      title="取消关注"
      message="确认取消关注吗？"
      confirm-text="确认取消"
      cancel-text="取消"
      @confirm="doFollowOperate(0)"
    />
    <!-- 背景图 -->
    <image
      class="fixed left-0 top-0 h-686rpx w-full"
      :src="creatorInfo?.backgroundUrl || '/static/images/top_bg.png'"
      :mode="creatorInfo?.backgroundUrl ? 'aspectFill' : 'scaleToFill'"
    />
    <!-- 背景图蒙版 -->
    <image
      class="fixed left-0 top-0 h-686rpx w-full" src="/static/images/me_top_bg.png"
      mode="scaleToFill"
    />

    <!-- 固定顶部区域 -->
    <view class="fixed left-0 top-0 z-50 w-full overflow-hidden" :style="{ height: `${statusNavTotalHeight + (isHeaderExpanded ? upx2px(BANNER_HEIGHT_RPX) : 0)}px` }">
      <image
        v-if="!creatorInfo?.backgroundUrl" class="absolute left-0 top-0 h-686rpx w-full" src="/static/images/top_bg.png"
        mode="widthFix"
      />
      <image
        v-if="creatorInfo?.backgroundUrl" class="absolute left-0 top-0 h-686rpx w-full" :src="creatorInfo.backgroundUrl"
        mode="scaleToFill"
      />
      <image
        class="absolute left-0 top-0 h-686rpx w-full" src="/static/images/me_top_bg.png" mode="scaleToFill"
      />
    </view>

    <!-- 头部右上角操作按钮 -->
    <view
      class="fixed z-[999] flex items-center gap-20rpx"
      :style="{
        top: `${menuButtonInfo.top}px`,
        height: `${menuButtonInfo.height}px`,
        right: headerButtonsRight,
      }"
    >
      <!-- 刷新/分享 -->
      <view class="relative h-64rpx w-64rpx flex items-center justify-center border-[1rpx] border-[#666]/10 rounded-full border-solid bg-white/70">
        <i class="iconfont icon-a-shuxingxianxingmingchengfenxiangzhuangtaioff text-40rpx text-[#333]" />
        <button open-type="share" class="absolute inset-0 h-full w-full border-none bg-transparent opacity-0" style="padding: 0; margin: 0; border: none; background: transparent;" />
      </view>
    </view>

    <!-- 用户信息区域 -->
    <view class="relative z-10 px-30rpx pt-40rpx">
      <!-- 第一行：头像、昵称 -->
      <view class="flex items-start">
        <!-- 左侧：头像和昵称信息 -->
        <view class="flex items-center gap-20rpx">
          <!-- 头像 -->
          <view class="h-128rpx w-128rpx overflow-hidden rounded-full bg-primary">
            <image
              class="h-full w-full" :src="creatorInfo?.avatar || '/static/images/default_picture.png'"
              mode="aspectFill" @error="creatorInfo.avatar = '/static/images/default_picture.png'"
            />
          </view>
          <!-- 昵称、Kanoo号 -->
          <view class="flex flex-col gap-8rpx">
            <text class="text-36rpx text-[#fff] font-semibold leading-[48rpx]">
              {{ creatorInfo?.nickname || '加载中...' }}
            </text>
            <view class="flex items-center gap-4rpx text-20rpx text-[#999]">
              <text class="leading-[28rpx]" @click="copyYuanqiId">Kanoo号：{{ creatorInfo?.uniqueCode || '-' }}</text>
              <!-- <image
                class="ml-1 h-24rpx w-24rpx" src="/static/images/qrcode.png" mode="scaleToFill" @click="toQrcode"
              /> -->
            </view>
          </view>
        </view>
      </view>

      <!-- 性别、年龄、生肖、星座标签 (新的一行) -->
      <view class="mt-24rpx flex items-center gap-16rpx">
        <!-- 性别图标 -->
        <view
          v-if="creatorInfo?.gender"
          class="h-44rpx w-44rpx flex flex-none items-center justify-center rounded-full bg-white/10"
          :class="creatorInfo?.gender === 2 ? 'text-[#FF4D4F]' : 'text-[#477FFF]'"
        >
          <i v-if="creatorInfo?.gender === 2" class="iconfont icon-a-shuxingnvxingzhuangtaion text-28rpx" />
          <i v-else-if="creatorInfo?.gender === 1" class="iconfont icon-a-shuxingnanxingzhuangtaion text-28rpx" />
        </view>
        <!-- 年龄标签 -->
        <view
          v-if="creatorInfo?.age"
          class="h-44rpx flex flex-none items-center justify-center rounded-full bg-white/10 px-20rpx"
        >
          <text class="text-24rpx text-[#CDCDCD] leading-[28rpx]">年龄：{{ creatorInfo.age }}</text>
        </view>
        <!-- 生肖 -->
        <view
          v-if="creatorInfo?.zodiac"
          class="h-44rpx flex flex-none items-center justify-center rounded-full bg-white/10 px-20rpx"
        >
          <text class="text-24rpx text-[#CDCDCD] leading-[28rpx]">生肖：{{ creatorInfo.zodiac }}</text>
        </view>
        <!-- 星座 -->
        <view
          v-if="creatorInfo?.constellation"
          class="h-44rpx flex flex-none items-center justify-center rounded-full bg-white/10 px-20rpx"
        >
          <text class="text-24rpx text-[#CDCDCD] leading-[28rpx]">星座：{{ creatorInfo.constellation }}</text>
        </view>
      </view>

      <!-- IP 系列标签 -->
      <view v-if="creatorInfo?.seriesName" class="mt-20rpx flex">
        <view class="h-36rpx flex items-center justify-center border-[1rpx] rounded-[999rpx] bg-[rgba(102,102,102,0.4)] px-20rpx">
          <text class="text-20rpx text-[#CDCDCD]">{{ creatorInfo.seriesName }}·认证作者</text>
        </view>
      </view>

      <!-- 第二行：关注数、粉丝数 -->
      <view class="mt-30rpx flex items-center">
        <view class="flex items-center gap-48rpx">
          <view class="flex items-baseline gap-8rpx">
            <text class="text-28rpx text-[#fff] font-semibold leading-[40rpx]">
              {{ followStats.followedCountStr }}
            </text>
            <text class="text-24rpx text-[#ccc] leading-[32rpx]">关注</text>
          </view>
          <view class="flex items-baseline gap-8rpx">
            <text class="text-28rpx text-[#fff] font-semibold leading-[40rpx]">{{ followStats.fansCountStr }}</text>
            <text class="text-24rpx text-[#ccc] leading-[32rpx]">粉丝</text>
          </view>
          <view class="flex items-baseline gap-8rpx" @click="showLikesFavoritesPopup = true">
            <text class="text-28rpx text-[#fff] font-semibold leading-[40rpx]">{{ followStats.fansCountStr }}</text>
            <text class="text-24rpx text-[#ccc] leading-[32rpx]">获赞与收藏</text>
          </view>
        </view>
      </view>

      <!-- 第三行：个人简介 -->
      <view class="mt-24rpx text-24rpx leading-[32rpx]">
        <view v-if="creatorInfo?.bio" class="relative">
          <view id="creator-bio-text" class="break-all pr-60rpx">
            <text
              class="block text-[#666]"
              :style="!isBioExpanded ? 'overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;' : ''"
            >
              {{ creatorInfo.bio }}
            </text>
          </view>

          <!-- 用于精确测量完整高度的隐藏元素，避免在可视元素上 toggling 引起闪烁 -->
          <view id="creator-bio-text-hidden" class="pointer-events-none absolute left-0 top-0 break-all pr-60rpx opacity-0 -z-10">
            <text class="block text-[#666]">
              {{ creatorInfo.bio }}
            </text>
          </view>

          <!-- 展开按钮：截断行末尾 -->
          <view
            v-if="!isBioExpanded && showBioExpandBtn" class="absolute right-0 top-0"
            @click.stop="isBioExpanded = true"
          >
            <text class="text-white underline underline-white">展开</text>
          </view>
          <!-- 收起按钮：文字下方右对齐 -->
          <view v-if="isBioExpanded && showBioExpandBtn" class="flex justify-end" @click.stop="isBioExpanded = false">
            <text class="text-white underline underline-white">收起</text>
          </view>
        </view>
        <text v-else-if="creatorInfo" class="text-[#999]">暂无个人简介</text>
      </view>

      <!-- 关注按钮 -->
      <view
        v-if="!isMe" class="mt-24rpx flex items-center justify-center border-[1rpx] border-white rounded-full border-solid px-24rpx py-16rpx"
        :class="isFollowed ? 'bg-transparent' : 'bg-white'" @click="handleFollow"
      >
        <text class="text-28rpx font-semibold leading-[40rpx]" :class="isFollowed ? 'text-white' : 'text-[#181818]'">
          {{ isFollowed ? '已关注' : '关注' }}
        </text>
      </view>
    </view>

    <!-- Banner 区域 -->
    <view
      v-if="creatorInfo?.bannerUrl" class="sticky z-100 mt-24rpx box-border h-160rpx w-full"
      :style="{ top: `${statusNavTotalHeight}px` }"
      @click="goToSeriesDetail(creatorInfo.seriesId!)"
    >
      <image class="block h-full w-full" :src="creatorInfo.bannerUrl" mode="scaleToFill" />
    </view>

    <view class="relative box-border" :class="creatorInfo?.bannerUrl ? 'mt-[-24rpx]' : 'mt-16rpx'">
      <!-- 标签栏容器：粘性布局 -->
      <view class="sticky z-101 rounded-t-24rpx bg-white" :style="{ top: `${statusNavTotalHeight + (creatorInfo?.bannerUrl ? upx2px(BANNER_HEIGHT_RPX) - upx2px(24) : 0)}px` }">
        <!-- 第一行标签 -->
        <view class="w-100rpx px-16rpx">
          <u-tabs
            :list="mainTabs"
            :is-scroll="false"
            item-width="100"
            gutter="0"
            active-color="#181818"
            inactive-color="#999"
            :current="currentMainTab"
            @change="(index: number) => currentMainTab = index"
          />
        </view>

        <!-- 第二行标签：分类筛选 - 首项固定 + 其余可滑动 + 排序筛选 -->
        <view class="mt-[16rpx] flex items-center px-32rpx py-16rpx">
          <template v-if="hasFixedFirstSubTab">
            <view
              class="box-border h-56rpx flex shrink-0 items-center justify-center rounded-full px-32rpx transition-all duration-200"
              :class="currentSubTab === 0 ? 'bg-primary text-white font-medium' : 'text-[#999] bg-[#F5F5F5]'"
              @click="handleSubTabClick(0)"
            >
              <text class="block text-28rpx leading-none">{{ subTabs[0].name }}</text>
            </view>
            <view
              class="mx-16rpx h-32rpx w-[2rpx] shrink-0"
              style="background-color: rgba(102, 102, 102, 0.15);"
            />
          </template>
          <scroll-view class="min-w-0 flex-1" scroll-x :show-scrollbar="false">
            <view class="flex items-center gap-16rpx">
              <view
                v-for="(tab, index) in scrollableSubTabs"
                :key="tab.id"
                class="box-border h-56rpx flex shrink-0 items-center justify-center rounded-full px-32rpx transition-all duration-200"
                :class="currentSubTab === (hasFixedFirstSubTab ? index + 1 : index) ? 'bg-primary text-white font-medium' : 'text-[#999] bg-[#F5F5F5]'"
                @click="handleSubTabClick(hasFixedFirstSubTab ? index + 1 : index)"
              >
                <text class="block text-28rpx leading-none">{{ tab.name }}</text>
              </view>
            </view>
          </scroll-view>

          <!-- 排序筛选 -->
          <view
            v-if="!isShowCollection && categoryFilter.hasSubTabs.value"
            class="relative ml-16rpx shrink-0"
          >
            <view class="center" @click.stop="toggleSort">
              <i class="iconfont icon-a-shuxingpaixu01zhuangtaioff mr-1 text-28rpx" />
              <span class="text-28rpx">{{ currentSortText }}</span>
              <!-- 红点提示 -->
              <view v-if="categoryFilter.hasSubTabSelected.value" class="absolute h-12rpx w-12rpx rounded-full bg-red-500 -right-8rpx -top-4rpx" />
            </view>
            <!-- 下拉菜单 -->
            <view
              class="absolute right-0 top-8 z-20 w-286rpx origin-top-right overflow-hidden rounded-md bg-white transition-all duration-200 ease-out"
              :class="isSortOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'"
              style="box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);"
            >
              <view
                v-for="(tab, index) in categoryFilter.subTabs.value" :key="tab.id"
                class="relative flex items-center justify-between px-4 py-2 text-sm active:bg-gray-100" :class="[
                  categoryFilter.currentSubTabId.value === tab.id ? 'text-black font-bold' : 'text-gray-500',
                ]" @click.stop="selectSort(tab.id)"
              >
                <span>{{ tab.name }}</span>
                <view v-if="categoryFilter.currentSubTabId.value === tab.id" class="i-carbon-checkmark text-24rpx text-[#181818]" />
                <view v-if="index !== categoryFilter.subTabs.value.length - 1" class="absolute bottom-0 left-0 right-0 h-1rpx bg-[rgba(102,102,102,0.1)]" />
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 渐变遮罩层 - 用height:0的sticky容器实现不占位又贴在顶部 -->
      <view class="pointer-events-none sticky left-0 w-full" :style="{ height: '0', top: `${statusNavTotalHeight + (creatorInfo?.bannerUrl ? upx2px(BANNER_HEIGHT_RPX) : 0) + upx2px(STICKY_TAB_BAR_HEIGHT_RPX)}px` }">
        <view class="w-full" :style="{ height: '80rpx', background: 'linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0))' }" />
      </view>

      <!-- 内容区域 -->
      <view v-if="isShowCollection" class="flex flex-1 flex-col bg-[#f5f5f5]" :style="listSectionMinHeightStyle">
        <IpCollectionList
          v-if="collectionList.length > 0" :list="collectionList" :has-more="false" mode="collection"
          :show-password="false" :user-level="creatorInfo.level" @handle-click="handleClick"
        />
        <!-- 底部提示：合集Tab有数据时显示（合集一次性加载，无需分页） -->
        <view v-if="collectionList.length > 0" class="py-40rpx text-center text-24rpx text-gray-400">
          - 到底了 -
        </view>
        <fg-empty v-if="collectionList.length === 0" :full-height="false" />
      </view>
      <!-- 创作Tab下的瀑布流 -->
      <view v-else class="flex flex-1 flex-col bg-[#f5f5f5]" :style="listSectionMinHeightStyle">
        <FgWaterfall
          v-if="waterfallData.length > 0" :list="waterfallData" :has-top-label="true"
          scene="1" @item-click="handleWaterfallItemClick" @asset-invalid="handleAssetInvalid"
          @all-images-loaded="isWaterfallImagesLoaded = true"
        />
        <!-- 底部提示：有数据、没有下一页、且图片全部加载完成时显示 -->
        <view
          v-if="waterfallData.length > 0 && !pageState.hasNext && !pageState.loading && isWaterfallImagesLoaded"
          class="py-40rpx text-center text-24rpx text-gray-400"
        >
          - 到底了 -
        </view>
        <fg-empty v-if="waterfallData.length === 0 && !pageState.loading" :full-height="false" />
      </view>
    </view>

    <!-- 获赞与收藏弹窗 -->
    <u-popup
      v-model="showLikesFavoritesPopup"
      mode="center"
      :zoom="false"
      :mask-close-able="true"
      :closeable="false"
      border-radius="32"
      width="580rpx"
      height="auto"
    >
      <view class="flex flex-col">
        <!-- 标题 -->
        <view class="px-40rpx pb-16rpx pt-32rpx">
          <text class="block text-center text-36rpx text-[#333] font-semibold">获赞与收藏</text>
        </view>

        <!-- 内容卡片 -->
        <view class="px-40rpx pt-16rpx">
          <view class="flex gap-20rpx">
            <view class="flex flex-1 flex-col items-center rounded-16rpx bg-[#F5F5F5] p-36rpx">
              <text class="text-44rpx text-[#333] font-semibold">0</text>
              <text class="mt-16rpx text-24rpx text-[#999]">当前发布作品数</text>
            </view>
            <view class="flex flex-1 flex-col items-center rounded-16rpx bg-[#F5F5F5] p-36rpx">
              <text class="text-44rpx text-[#333] font-semibold">0</text>
              <text class="mt-16rpx text-24rpx text-[#999]">当前发布图库数</text>
            </view>
          </view>
          <view class="mt-24rpx flex gap-20rpx">
            <view class="flex flex-1 flex-col items-center rounded-16rpx bg-[#F5F5F5] p-36rpx">
              <text class="text-44rpx text-[#333] font-semibold">0</text>
              <text class="mt-16rpx text-24rpx text-[#999]">当前获得点赞数</text>
            </view>
            <view class="flex flex-1 flex-col items-center rounded-16rpx bg-[#F5F5F5] p-36rpx">
              <text class="text-44rpx text-[#333] font-semibold">0</text>
              <text class="mt-16rpx text-24rpx text-[#999]">当前获得收藏数</text>
            </view>
          </view>
        </view>

        <!-- 按钮 -->
        <view class="p-40rpx">
          <view class="flex items-center justify-center rounded-full bg-[#333] py-24rpx" @click="showLikesFavoritesPopup = false">
            <text class="text-32rpx text-white font-semibold">我知道了</text>
          </view>
        </view>
      </view>
    </u-popup>
  </view>
</template>

<style scoped lang="scss">
</style>
