<script lang="ts" setup>
import { onHide, onLoad, onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { checkSeriesOnShelf } from '@/api/common'
import { cleanInvalidFavoriteOrLike, getFavoriteOrLikeList, getFollowStats, getMyAssetList, getMyCollectionList, listMyCollect } from '@/api/me/me'
import IpCollectionList from '@/components/ip-collection-list/ip-collection-list.vue'
import PhoneLoginPopup from '@/components/phone-login-popup/phone-login-popup.vue'
import { useCategoryFilter } from '@/composables/useCategoryFilter'
import { showCustomToast } from '@/composables/useCustomToast'
import { getListSectionMinHeightStyle, getProfileMeTabFilterBarTopPx, PROFILE_STICKY_HEIGHT_RPX } from '@/constants/listSectionLayout'
import { usePageScrollBridge } from '@/hooks/usePageScrollBridge'
import top_bg from '@/static/images/top_bg.png'
import { usePageScrollStore } from '@/store/pageScroll'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { useWorksDetailsStore } from '@/store/worksDetails'
import { getImgUrl } from '@/utils'
import { requireLogin } from '@/utils/auth'
import { menuButtonInfo, statusNavTotalHeight, systemInfo } from '@/utils/systemInfo'
import { toLoginPage } from '@/utils/toLoginPage'

definePage({
  // type: 'home',
  style: {
    navigationBarTitleText: '',
    enablePullDownRefresh: true,
  },
})

// 与首页一致：显式同步页面滚动到全局 store，供 App.ku 中「回到顶部」使用（避免仅依赖构建注入）
usePageScrollBridge()

const upx2px = (rpx: number) => uni.upx2px(rpx)

const pageScrollStore = usePageScrollStore()
const userStore = useUserStore()
/** 与首页一致：筛选栏（Tab 区）是否已吸顶、吸顶时 pageScrollTo 的目标 scrollTop */
const isFilterSticky = ref(false)
const filterStickyScrollTop = ref(0)
// 排序筛选状态
const isSortOpen = ref(false)
const currentSortId = ref<string>('')

/** Banner 高度 */
const BANNER_HEIGHT_RPX = 160
/** Banner 吸附阈值：Header(686rpx) + Divider(20rpx) + mt-24rpx = 730rpx */
const BANNER_STICK_THRESHOLD_RPX = 730
/** Sticky Tab Bar 高度：主Tab(84rpx) + 分类行(16rpx+16rpx+56rpx) = 172rpx */
const STICKY_TAB_BAR_HEIGHT_RPX = 160
/** Banner 吸附时 Header 展开状态 */
const isHeaderExpanded = ref(false)

onPageScroll((e) => {
  const st = e.scrollTop ?? 0
  pageScrollStore.setScrollTop(st)
  const filterBarTop = getProfileMeTabFilterBarTopPx(!!userStore.userInfo?.bannerUrl)
  isFilterSticky.value = st >= filterBarTop
  if (isFilterSticky.value)
    filterStickyScrollTop.value = filterBarTop
  // Banner 吸附时展开 Header 高度
  const bannerStickThresholdPx = uni.upx2px(BANNER_STICK_THRESHOLD_RPX)
  isHeaderExpanded.value = st >= bannerStickThresholdPx
  // 页面滚动时隐藏排序筛选下拉
  if (isSortOpen.value)
    isSortOpen.value = false
})

const tokenStore = useTokenStore()
const worksDetailsStore = useWorksDetailsStore()
const userInfo = computed(() => userStore.userInfo)

const listSectionMinHeightStyle = computed(() => getListSectionMinHeightStyle({
  stickyHeightRpx: PROFILE_STICKY_HEIGHT_RPX,
  bottomReserveRpx: userInfo.value.bannerUrl ? BANNER_HEIGHT_RPX : 0,
}))

// 头部操作按钮的right定位
const headerButtonsRight = computed(() => {
  // #ifdef MP-TOUTIAO
  return `${systemInfo.windowWidth - menuButtonInfo.left + 10 + 60}px`
  // #endif
  // #ifndef MP-TOUTIAO
  return `${systemInfo.windowWidth - menuButtonInfo.left + 10}px`
  // #endif
})

const computedConstellation = computed(() => {
  if (!userInfo.value?.birthday)
    return ''
  const date = new Date(userInfo.value.birthday)
  if (Number.isNaN(date.getTime()))
    return ''
  const month = date.getMonth() + 1
  const day = date.getDate()
  const constellations = [
    { sign: '水瓶座', start: [1, 20], end: [2, 18] },
    { sign: '双鱼座', start: [2, 19], end: [3, 20] },
    { sign: '白羊座', start: [3, 21], end: [4, 19] },
    { sign: '金牛座', start: [4, 20], end: [5, 20] },
    { sign: '双子座', start: [5, 21], end: [6, 21] },
    { sign: '巨蟹座', start: [6, 22], end: [7, 22] },
    { sign: '狮子座', start: [7, 23], end: [8, 22] },
    { sign: '处女座', start: [8, 23], end: [9, 22] },
    { sign: '天秤座', start: [9, 23], end: [10, 23] },
    { sign: '天蝎座', start: [10, 24], end: [11, 22] },
    { sign: '射手座', start: [11, 23], end: [12, 21] },
    { sign: '摩羯座', start: [12, 22], end: [1, 19] },
  ]
  for (const c of constellations) {
    if (
      (month === c.start[0] && day >= c.start[1])
      || (month === c.end[0] && day <= c.end[1])
    ) {
      return c.sign
    }
  }
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
    return '摩羯座'
  return ''
})

const avatarLoadFailed = ref(false)
watch(() => userInfo.value?.avatar, () => {
  avatarLoadFailed.value = false
})

// 手机号登录弹窗状态
const showPhoneLoginAlert = ref(false)

// 个人简介展开状态
// 默认隐藏展开按钮，通过隐藏的 ghost 元素量出完整高度后再决定是否显示
const showBioExpandBtn = ref(false)
const isBioExpanded = ref(false)

// 关注和粉丝统计数据
const followStats = ref({
  fansCountStr: '0',
  followedCountStr: '0',
  receivedLikeCountStr: '0',
  receivedCollectCountStr: '0',
  likeAndCollectCountStr: '0',
  contentCountStr: '0',
  assetCountStr: '0',
})

// 获赞与收藏弹窗
const showLikesFavoritesPopup = ref(false)

// 第一行标签数据
const mainTabs = ['创作', '收藏', '赞过']
const currentMainTab = ref(0)
const mainTabLineLeft = ref(0)
const mainTabLineWidth = ref(18)

// 使用 composable 管理一级和二级分类（不跟随变更）
const categoryFilter = useCategoryFilter({
  enableSubTabSync: false,
})

// 当前选中的标签名称（用于合集/IP系列特殊标签）
const currentSubTabName = ref('全部')
// 当前选中的标签ID（用于合集/IP系列特殊标签）
const currentSubTabId = ref<string | number>('')

const collectionList = ref<any[]>([])
const waterfallData = ref<any[]>([])
// IP系列列表状态（收藏）
const ipSeriesFavorites = ref<any[]>([])
// IP系列是否已下架（用于控制合集标签显示）
const isIpSeriesOffShelf = ref(false)
const ipSeriesPage = reactive({
  pageNum: 1,
  pageSize: 10,
  hasMore: true,
  loading: false,
})

// 瀑布流分页状态
const pageState = reactive({
  nextCursorId: undefined as number | undefined,
  nextCursorIsTop: undefined as number | undefined,
  nextCursorScore: undefined as number | undefined,
  hasNext: true,
  loading: false,
})
// 瀑布流图片是否全部加载完成
const isWaterfallImagesLoaded = ref(false)

// 失效素材计数（saleStatus=2已下架 或 3用户已删除）
const invalidAssetCount = ref(0)
// 失效素材 ID 列表（用于清理接口）
const invalidAssetIds = ref<string[]>([])
// 清理确认弹窗状态
const showCleanupDialog = ref(false)
// 清理中状态
const isCleaning = ref(false)

// 动态计算标签：根据主Tab变化
const subTabs = computed(() => {
  // 创作
  if (currentMainTab.value === 0) {
    // 只有有合集且IP系列未下架时才显示合集标签
    return collectionList.value.length > 0 && !isIpSeriesOffShelf.value
      ? [{ id: 'collection', name: '合集' }, ...categoryFilter.tabs.value]
      : categoryFilter.tabs.value
  }
  // 收藏
  if (currentMainTab.value === 1) {
    // 只有收藏了IP系列才显示IP系列标签
    return ipSeriesFavorites.value.length > 0
      ? [{ id: 'ip-series', name: 'IP系列' }, ...categoryFilter.tabs.value]
      : [...categoryFilter.tabs.value]
  }
  // 赞过
  return [...categoryFilter.tabs.value]
})

// 计算当前选中的索引，用于模板绑定高亮样式
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

const isShowCollection = computed(() => currentMainTab.value === 0 && currentSubTabName.value === '合集')
const isShowIpSeries = computed(() => currentMainTab.value === 1 && currentSubTabName.value === 'IP系列')

// 排序筛选显示文本
const currentSortText = computed(() => {
  return categoryFilter.subTabDisplayText.value
})

const isDataLoaded = ref(false)

// 获取合集列表
async function fetchCollectionList() {
  // 如果官方帐号的IP系列已下架，不获取合集列表
  if (isIpSeriesOffShelf.value)
    return
  try {
    const res = await getMyCollectionList()
    // 映射到组件要求的属性
    collectionList.value = (res?.records || []).map((item: any) => ({
      ...item,
      name: item.title,
      count: item.assetCount,
      countFormatted: item.assetCountFormatted,
      popCount: item.popularityStr,
      bg: item.coverUrl,
      images: item.topAssets?.map((a: any) => a.thumbUrl) || [],
    }))

    // 如果之前选中了“合集”，但获取后发现没有合集，则切换到“全部”
    if (collectionList.value.length === 0 && currentSubTabName.value === '合集') {
      currentSubTabName.value = '全部'
    }
    else if (collectionList.value.length > 0 && currentSubTabName.value === '全部' && waterfallData.value.length === 0) {
      currentSubTabName.value = '合集'
    }
    return true
  }
  catch (error) {
    console.error('获取合集失败', error)
    return false
  }
}

// 获取素材列表 (包括创作下的素材、收藏/赞过下的素材)
async function fetchAssetList(isRefresh = false) {
  if (pageState.loading || (!pageState.hasNext && !isRefresh))
    return false
  pageState.loading = true

  if (isRefresh) {
    pageState.nextCursorId = undefined
    pageState.nextCursorScore = undefined
    pageState.hasNext = true
    // 刷新时重置失效素材计数
    invalidAssetCount.value = 0
  }
  // 重置图片加载状态
  isWaterfallImagesLoaded.value = false

  try {
    const rawId = currentSubTabId.value
    const categoryId = (rawId !== '' && rawId !== 'collection' && rawId !== 'ip-series' && !Number.isNaN(Number(rawId))) ? Number(rawId) : undefined
    let resRecords: any[] = []
    let nextCursorId: number | undefined
    let nextCursorIsTop: number | undefined
    let nextCursorScore: number | undefined
    let hasNext = false

    // 如果是"创作"，调用 getMyAssetList
    if (currentMainTab.value === 0) {
      const res = await getMyAssetList({
        pageSize: 20,
        cursorId: pageState.nextCursorId,
        cursorIsTop: pageState.nextCursorIsTop,
        sortOrder: pageState.nextCursorScore,
        category: categoryId as number,
        fileType: categoryFilter.currentSubTabId.value ? Number(categoryFilter.currentSubTabId.value) : undefined,
      })
      resRecords = res.records
      nextCursorId = res.nextCursorId ?? undefined
      nextCursorIsTop = res.nextCursorIsTop ?? undefined
      nextCursorScore = res.nextCursorScore ?? undefined
      hasNext = res.hasNext
    }
    else {
      // 如果是"收藏"(2) 或 "赞过"(1)，调用 getFavoriteOrLikeList
      const type = currentMainTab.value === 1 ? 2 : 1
      const res = await getFavoriteOrLikeList({
        pageSize: 20,
        cursorId: pageState.nextCursorId,
        type: type as 1 | 2,
        assetsCategory: categoryId as number,
        fileType: categoryFilter.currentSubTabId.value ? Number(categoryFilter.currentSubTabId.value) : undefined,
      })
      resRecords = res.records
      nextCursorId = res.nextCursorId ?? undefined
      nextCursorScore = res.nextCursorScore ?? undefined
      hasNext = res.hasNext
      resRecords.forEach((item) => {
        item.relationId = item.interactionStateId
      })
      const hiddenTotal = Number(res.hiddenTotal ?? 0)
      invalidAssetCount.value = isRefresh ? hiddenTotal : invalidAssetCount.value + hiddenTotal
    }

    if (isRefresh) {
      waterfallData.value = resRecords
    }
    else {
      waterfallData.value.push(...resRecords)
    }

    pageState.nextCursorId = nextCursorId
    pageState.nextCursorIsTop = nextCursorIsTop
    pageState.nextCursorScore = nextCursorScore
    pageState.hasNext = hasNext
    return true
  }
  catch (error) {
    console.error('获取列表失败', error)
    return false
  }
  finally {
    pageState.loading = false
  }
}

// 获取收藏的IP系列
async function fetchIpSeriesFavorites(isRefresh = false) {
  if (ipSeriesPage.loading || (!ipSeriesPage.hasMore && !isRefresh))
    return
  ipSeriesPage.loading = true

  if (isRefresh) {
    ipSeriesPage.pageNum = 1
    ipSeriesPage.hasMore = true
  }

  try {
    const res = await listMyCollect({
      entityType: 5,
      pageNum: ipSeriesPage.pageNum,
      pageSize: ipSeriesPage.pageSize,
    })

    const records = res?.records || []

    // 映射到 IpSeriesGrid 要求的属性
    const newItems = records.map(item => ({
      id: item.contentId,
      bannerImg: item.coverImgUrl,
      bannerName: item.title,
      hotValue: item.popularity || 0,
      hotValueStr: item.popularityStr || '',
    }))

    if (isRefresh) {
      ipSeriesFavorites.value = newItems
    }
    else {
      ipSeriesFavorites.value.push(...newItems)
    }

    ipSeriesPage.pageNum += 1
    ipSeriesPage.hasMore = records.length === ipSeriesPage.pageSize
    return true
  }
  catch (error) {
    console.error('获取IP系列收藏失败', error)
    return false
  }
  finally {
    ipSeriesPage.loading = false
  }
}

// 子 Tab 列表变化时，若当前选中的名称已不存在（例如取消全部 IP 系列收藏后「IP系列」被移除），
// 需同步 currentSubTabName/Id，否则会高亮「全部」但仍按「IP系列」请求 listMyCollect
watch(
  subTabs,
  (tabs) => {
    if (!tabs.length)
      return
    const idx = tabs.findIndex(t => t.name === currentSubTabName.value)
    if (idx !== -1)
      return

    const prevName = currentSubTabName.value
    currentSubTabName.value = tabs[0].name
    currentSubTabId.value = tabs[0].id

    if (prevName === 'IP系列' && currentMainTab.value === 1) {
      fetchAssetList(true)
    }
    else if (prevName === '合集' && currentMainTab.value === 0) {
      fetchAssetList(true)
    }
  },
  { flush: 'post' },
)

// 页面触底事件，加载更多素材
onReachBottom(() => {
  if (isShowCollection.value)
    return
  if (isShowIpSeries.value) {
    fetchIpSeriesFavorites()
  }
  else {
    fetchAssetList()
  }
})

// 获取关注统计
async function fetchFollowStats() {
  try {
    const res = await getFollowStats()
    followStats.value = {
      fansCountStr: res.fansCountStr || '0',
      followedCountStr: res.followedCountStr || '0',
      receivedLikeCountStr: res.receivedLikeCountStr || '0',
      receivedCollectCountStr: res.receivedCollectCountStr || '0',
      likeAndCollectCountStr: res.likeAndCollectCountStr || '0',
      contentCountStr: res.contentCountStr || '0',
      assetCountStr: res.assetCountStr || '0',
    }
    return true
  }
  catch (error) {
    console.error('获取关注统计失败', error)
    return false
  }
}

// 复制Kanoo号
function copyYuanqiId() {
  uni.setClipboardData({
    data: userInfo.value.uniqueCode,
    success: () => {
      // 复制的toast必须用uni提供的，否则无法覆盖原生toast
      uni.showToast({ title: '已复制', icon: 'success' })
    },
    fail: (err) => {
      console.log('复制失败', err)
      // 复制的toast必须用uni提供的，否则无法覆盖原生toast
      uni.showToast({ title: '复制失败', icon: 'none' })
    },
  })
}

// 跳转二维码页面
function toQrcode() {
  uni.navigateTo({
    url: '/pages/me/qrcode',
  })
}

// 更新第一行标签下划线位置
function updateLineStyle() {
  nextTick(() => {
    uni.createSelectorQuery()
      .select(`#main-tab-${currentMainTab.value}`)
      .boundingClientRect((rect: any) => {
        if (rect) {
          uni.createSelectorQuery()
            .select('.main-tabs__nav')
            .boundingClientRect((parent: any) => {
              if (parent) {
                mainTabLineLeft.value = rect.left - parent.left + (rect.width - mainTabLineWidth.value) / 2
              }
            })
            .exec()
        }
      })
      .exec()
  })
}

// 切换第一行标签
function handleMainTabClick(index: number) {
  if (currentMainTab.value === index)
    return
  currentMainTab.value = index
  updateLineStyle()
  // 切换 tab 时隐藏下拉菜单
  closeSort()
  // 重置 categoryFilter 的二级分类
  categoryFilter.resetSubTab()
  // 与首页 handleTabClick 一致：筛选栏已置顶时滚到置顶位置，再拉数据
  if (isFilterSticky.value) {
    uni.pageScrollTo({
      scrollTop: filterStickyScrollTop.value,
      duration: 0,
    })
  }
  const defaultSubTab = subTabs.value[0]
  if (!defaultSubTab)
    return

  currentSubTabName.value = defaultSubTab.name
  currentSubTabId.value = defaultSubTab.id

  if (defaultSubTab.name === 'IP系列') {
    fetchIpSeriesFavorites(true)
  }
  else if (defaultSubTab.name !== '合集') {
    fetchAssetList(true)
  }
}

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

  // 同步更新 composable 中的一级分类（即使 enableSubTabSync 为 false，也需要保持状态一致）
  if (tab.id !== 'collection' && tab.id !== 'ip-series') {
    categoryFilter.selectTab(tab.id as string)
  }

  if (tab.name === 'IP系列') {
    fetchIpSeriesFavorites(true)
  }
  else if (tab.name !== '合集') {
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
  if (isFilterSticky.value) {
    uni.pageScrollTo({
      scrollTop: filterStickyScrollTop.value,
      duration: 0,
    })
  }
  categoryFilter.selectSubTab(optionId)
  isSortOpen.value = false
  // 刷新列表
  if (!isShowCollection.value && !isShowIpSeries.value) {
    fetchAssetList(true)
  }
}

// 处理瀑布流item点击
function handleWaterfallItemClick(item: any, index: number, detail: any) {
  if (!requireLogin())
    return
  worksDetailsStore.setEntrySource('me')
  worksDetailsStore.setCurrentItem(item, index, detail)

  // 构建tab列表：当前项 + 前100条 + 后100条
  const tabList = buildTabList(index)
  worksDetailsStore.setPreloadedTabList(tabList)

  uni.navigateTo({
    url: `/pages/worksDetails/index?id=${(item.assetsId || item.id)}`,
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
  fetchAssetList(true)
}

// 清理失效素材
async function handleCleanup() {
  showCleanupDialog.value = false
  if (isCleaning.value)
    return
  isCleaning.value = true

  try {
    uni.showLoading({ title: '清理中...' })

    // 根据当前 Tab 决定类型：收藏=2，赞过=1
    const type: 1 | 2 = currentMainTab.value === 1 ? 2 : 1
    await cleanInvalidFavoriteOrLike(type)

    uni.hideLoading()
    showCustomToast({ title: '清理完成', icon: 'success' })
    // 刷新列表
    await fetchAssetList(true)
  }
  catch (error) {
    console.error('清理失效素材失败', error)
    uni.hideLoading()
    showCustomToast({ title: '清理失败，请重试', icon: 'none' })
  }
  finally {
    isCleaning.value = false
  }
}

// 跳转我的合集素材页面
function toCollectionAssets(item: any) {
  // 普通帐号跳转collectionDetails  官方帐号跳转ipCollectionDetails
  if (userInfo.value?.level === 4)
    uni.navigateTo({ url: `/pages/ipCollectionDetails/index?id=${item.id}&fromCreator=1&title=${item.name}&creatorId=${userInfo.value.id}&creatorLevel=${userInfo.value?.level}` })
  else
    uni.navigateTo({ url: `/pages/collectionDetails/index?id=${item.id}&creatorId=${userInfo.value.id}` })
}

// 跳转到IP系列详情
function goToSeriesDetail(id: string | number, frombanner = false) {
  if (!requireLogin())
    return
  if (!id)
    return
  const query = !frombanner ? '&showCollect=1' : ''
  uni.navigateTo({ url: `/pages/ipSeriesDetails/index?seriesId=${id}${query}` })
}

// 跳转到浏览记录
function goToHistory() {
  if (!requireLogin())
    return
  uni.navigateTo({ url: `/pages/history/index` })
}

// 跳转到创作空间
function goToCreativeSpace() {
  if (!requireLogin())
    return
  if (!userInfo.value.phone) {
    showPhoneLoginAlert.value = true
    return
  }
  uni.navigateTo({ url: `/pages/creativeSpace/index` })
}

// 去手机号登录
function onGoToPhoneLogin() {
  showPhoneLoginAlert.value = false
  uni.navigateTo({ url: '/pages/login/phone' })
}

// 跳转到设置
function goToSettings() {
  if (!requireLogin())
    return
  uni.navigateTo({ url: `/pages/settings/index` })
}

// 跳转到编辑资料
function goToEdit() {
  if (!requireLogin())
    return
  uni.navigateTo({ url: `/pages/me/edit` })
}

// 跳转到编辑资料
function goToEditBio() {
  if (!requireLogin())
    return
  uni.navigateTo({ url: `/pages/me/editBio` })
}

// 监听标签变化，更新下划线位置
watch(currentMainTab, () => {
  updateLineStyle()
})

async function checkIpSeriesStatus() {
  const seriesId = userStore.userInfo?.seriesId
  if (!seriesId)
    return true // 没有seriesId时默认显示合集

  try {
    await checkSeriesOnShelf({ seriesId })
    isIpSeriesOffShelf.value = false
    return true
  }
  catch (error: any) {
    // code = 4002 表示IP系列暂不可访问（已下架）
    if (error?.code === 4002) {
      isIpSeriesOffShelf.value = true
      return false
    }
    return true
  }
}

async function loadPageData() {
  if (!tokenStore.hasLogin)
    return

  if (!isDataLoaded.value) {
    userStore.fetchUserInfo()
    if (userInfo.value?.level === 4) {
      await checkIpSeriesStatus()
    }
    else {
      isIpSeriesOffShelf.value = false
    }
    Promise.all([
      fetchFollowStats(),
      fetchCollectionList(),
      fetchAssetList(true),
      fetchIpSeriesFavorites(true), // 获取IP系列收藏列表，用于判断标签显示
    ]).then((results) => {
      const allSuccess = results.every(result => result === true)
      if (allSuccess) {
        isDataLoaded.value = true
      }
    })
  }
  else if (currentMainTab.value !== 0) {
    // 数据已加载且当前不是创作Tab时，刷新素材列表
    fetchAssetList(true)
    if (currentMainTab.value === 1) {
      fetchIpSeriesFavorites(true)
    }
  }
}

// 页面挂载后更新下划线位置
onMounted(() => {
  nextTick(() => {
    updateLineStyle()
  })
})

// 页面加载时注册事件监听
onLoad(() => {
  if (!tokenStore.hasLogin) {
    toLoginPage({ mode: 'reLaunch' })
    return
  }
  // 监听合集列表需要刷新的事件
  uni.$on('collectionListNeedRefresh', () => {
    fetchCollectionList()
  })
  uni.$on('collectionAssetsUpdated', () => {
    fetchCollectionList()
  })
  // 监听素材列表需要刷新的事件
  uni.$on('assetListNeedRefresh', () => {
    fetchAssetList(true)
  })
})

// 页面显示时获取最新用户信息
onShow(() => {
  pageScrollStore.setToTopBottom('72rpx')
  // 等待页面加载完成后再执行
  setTimeout(() => {
    if (uni.getStorageSync('needRefreshFromException') === '1') {
      uni.removeStorageSync('needRefreshFromException')
      isDataLoaded.value = false
    }

    // 检查是否是从创作空间返回
    if (uni.getStorageSync('fromCreativeSpace') === '1') {
      uni.removeStorageSync('fromCreativeSpace')
      // 如果是从创作空间返回且当前是创作Tab，刷新合集和素材列表
      if (currentMainTab.value === 0) {
        fetchCollectionList()
        fetchAssetList(true)
      }
    }

    loadPageData()
  }, 100)
  // 账号切换时 bio watch 在页面隐藏状态触发，createSelectorQuery 上下文错误导致 rect=null
  // onShow 时重新在正确的页面上下文中测量 bio 溢出状态
  // 仅在需要时（首次或 bio 变化后）重新测量，避免不必要的闪烁
  if (userInfo.value?.bio) {
    // 保持当前按钮状态，仅重置展开状态
    isBioExpanded.value = false
    nextTick(() => {
      checkBioOverflow()
    })
  }
  else {
    showBioExpandBtn.value = false
    isBioExpanded.value = false
  }
})

// 页面隐藏时隐藏下拉菜单
onHide(() => {
  closeSort()
})

// 下拉刷新
const isRefreshing = ref(false)
onPullDownRefresh(async () => {
  if (isRefreshing.value)
    return
  isRefreshing.value = true
  try {
    if (userInfo.value?.level === 4) {
      await checkIpSeriesStatus()
    }
    else {
      isIpSeriesOffShelf.value = false
    }
    await Promise.all([
      userStore.fetchUserInfo(),
      fetchFollowStats(),
      fetchCollectionList(),
      isShowIpSeries.value ? fetchIpSeriesFavorites(true) : fetchAssetList(true),
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

watch(() => tokenStore.hasLogin, (newVal) => {
  if (!newVal) {
    isDataLoaded.value = false
    waterfallData.value = []
    collectionList.value = []
    ipSeriesFavorites.value = []
    followStats.value = {
      fansCountStr: '0',
      followedCountStr: '0',
      receivedLikeCountStr: '0',
      receivedCollectCountStr: '0',
      likeAndCollectCountStr: '0',
      contentCountStr: '0',
      assetCountStr: '0',
    }
  }
  else {
    loadPageData()
  }
})

// 监听用户ID变化（例如切换账号时），重置数据并重新加载
watch(() => userInfo.value?.id, (newVal, oldVal) => {
  if (newVal && oldVal && newVal !== oldVal) {
    isDataLoaded.value = false
    waterfallData.value = []
    collectionList.value = []
    ipSeriesFavorites.value = []
    followStats.value = {
      fansCountStr: '0',
      followedCountStr: '0',
      receivedLikeCountStr: '0',
      receivedCollectCountStr: '0',
      likeAndCollectCountStr: '0',
      contentCountStr: '0',
      assetCountStr: '0',
    }

    // 重置标签页
    currentMainTab.value = 0
    currentSubTabName.value = '全部'
    currentSubTabId.value = ''

    // 重置简介展开状态
    showBioExpandBtn.value = false
    isBioExpanded.value = false

    // 重新获取数据
    if (tokenStore.hasLogin) {
      loadPageData()
    }
  }
})

// 监听简介变化以计算是否需要展示展开按钮
const bioCheckTimer = ref<ReturnType<typeof setTimeout> | null>(null)
function checkBioOverflow() {
  // 延迟执行，确保DOM已经更新
  if (bioCheckTimer.value) {
    clearTimeout(bioCheckTimer.value)
  }
  bioCheckTimer.value = setTimeout(() => {
    const query = uni.createSelectorQuery()
    query
      .select('#bio-text')
      .boundingClientRect((rect: any) => {
        if (rect) {
          const lineHeight = uni.upx2px(32)
          // 获取完整内容的高度
          // 在带有 webkit-line-clamp: 1 的情况下，boundingClientRect 拿到的是截断后的高度。
          // 但是我们可以通过另一个隐藏的完全相同的元素来测量，或者通过字数估算。
          // 更优雅的方法是：利用 scrollHeight。在 uniapp 里，可以使用 node 模块。
          const query = uni.createSelectorQuery()
          query.select('#bio-text-hidden').boundingClientRect((rectHidden: any) => {
            if (rectHidden && rectHidden.height > lineHeight + 2) {
              showBioExpandBtn.value = true
            }
            else {
              showBioExpandBtn.value = false
            }
          }).exec()
        }
      })
      .exec()
  }, 50)
}

watch(() => userInfo.value?.bio, (newVal) => {
  isBioExpanded.value = false
  if (!newVal) {
    showBioExpandBtn.value = false
    return
  }
  nextTick(() => {
    checkBioOverflow()
  })
}, { immediate: true })

// 分享功能
onShareAppMessage(() => {
  const shareTitle = userInfo.value?.nickname
    ? `${userInfo.value.nickname}的个人主页`
    : '个人主页'
  let shareImage = ''
  // #ifdef MP-TOUTIAO
  shareImage = getImgUrl('/assets/mp/temp/tt_share.png')
  // #endif
  // #ifdef MP-WEIXIN
  shareImage = getImgUrl('/assets/mp/temp/wx_share.png')
  // #endif
  // #ifndef MP-TOUTIAO || MP-WEIXIN
  shareImage = userInfo.value?.avatar || ''
  // #endif
  const sharePath = `/pages/creatorDetails/index?id=${userInfo.value.id || ''}`

  return {
    title: shareTitle,
    path: sharePath,
    imageUrl: shareImage,
  }
})
</script>

<template>
  <!-- 未登录状态拦截：真实的页面级 Skeleton（骨架屏）动画，平滑过渡跳转 -->
  <view v-if="!tokenStore.hasLogin" class="relative min-h-screen overflow-hidden">
    <CommonHeader mode="auto" :scroll-top="0" />
    <custom-title text="我的" text-color="text-main" />
    <!-- 背景图骨架 -->
    <view class="fixed left-0 top-0 h-686rpx w-full animate-pulse bg-[#e5e5e5] opacity-50" />
    <view class="fixed left-0 top-0 z-50 w-full overflow-hidden" :style="{ height: `${statusNavTotalHeight}px` }">
      <view class="h-full w-full animate-pulse bg-[#e5e5e5] opacity-50" />
    </view>

    <!-- 用户信息骨架 -->
    <view class="relative z-10 px-30rpx pt-40rpx">
      <!-- 头像和昵称行 -->
      <view class="flex items-start justify-between">
        <view class="flex items-center gap-20rpx">
          <view class="h-128rpx w-128rpx animate-pulse rounded-full bg-black/10" />
          <view class="flex flex-col gap-12rpx">
            <view class="h-44rpx w-240rpx animate-pulse rounded-8rpx bg-black/10" />
            <view class="mt-8rpx flex gap-12rpx">
              <view class="h-32rpx w-100rpx animate-pulse rounded-sm bg-black/10" />
              <view class="h-32rpx w-120rpx animate-pulse rounded-sm bg-black/10" />
            </view>
          </view>
        </view>
        <!-- 按钮组 -->
        <view class="flex items-center gap-30rpx">
          <view class="h-72rpx w-72rpx animate-pulse rounded-24rpx bg-black/10" />
          <view class="h-72rpx w-72rpx animate-pulse rounded-24rpx bg-black/10" />
        </view>
      </view>

      <!-- 标签行 -->
      <view class="mt-20rpx h-28rpx w-160rpx animate-pulse rounded-6rpx bg-black/10" />

      <!-- 数据与编辑按钮 -->
      <view class="mt-40rpx flex items-center justify-between">
        <view class="flex items-center gap-60rpx">
          <view class="h-40rpx w-120rpx animate-pulse rounded-6rpx bg-black/10" />
          <view class="h-40rpx w-120rpx animate-pulse rounded-6rpx bg-black/10" />
        </view>
        <view class="h-64rpx w-160rpx animate-pulse rounded-full bg-black/10" />
      </view>

      <!-- 简介 -->
      <view class="mt-32rpx h-32rpx w-10/12 animate-pulse rounded-6rpx bg-black/10" />

      <!-- 卡片行 -->
      <view class="mt-40rpx flex items-center justify-between gap-20rpx">
        <view class="h-88rpx flex-1 animate-pulse rounded-16rpx bg-black/10" />
        <view class="h-88rpx flex-1 animate-pulse rounded-16rpx bg-black/10" />
      </view>
    </view>

    <!-- 下方内容区域骨架 -->
    <view class="relative z-10 mt-16rpx min-h-[500rpx] rounded-t-24rpx bg-white pt-20rpx">
      <!-- 列表内容骨架模拟 -->
      <view class="mt-30rpx flex gap-20rpx px-30rpx">
        <view class="h-400rpx flex-1 animate-pulse rounded-16rpx bg-[#f5f5f5]" />
        <view class="h-400rpx flex-1 animate-pulse rounded-16rpx bg-[#f5f5f5]" />
      </view>
    </view>
  </view>

  <!-- 正常已登录后的页面内容 -->
  <view
    v-else class="relative min-h-screen bg-[#333333]"
  >
    <CommonHeader mode="auto" :scroll-top="0" />
    <custom-title :show-back="true" text="我的" text-color="text-white" />

    <!-- 头部右上角操作按钮 -->
    <view
      class="fixed z-[999] flex items-center gap-20rpx"
      :style="{
        top: `${menuButtonInfo.top}px`,
        height: `${menuButtonInfo.height}px`,
        right: headerButtonsRight,
      }"
    >
      <!-- 编辑资料 -->
      <view class="h-64rpx w-64rpx flex items-center justify-center border-[1rpx] border-[#666]/10 rounded-full border-solid bg-white/70" @click="goToEdit">
        <i class="iconfont icon-a-shuxingbianjizhuangtaioff text-40rpx text-[#333]" />
      </view>
      <!-- 刷新/分享 -->
      <view class="relative h-64rpx w-64rpx flex items-center justify-center border-[1rpx] border-[#666]/10 rounded-full border-solid bg-white/70">
        <i class="iconfont icon-a-shuxingxianxingmingchengfenxiangzhuangtaioff text-40rpx text-[#333]" />
        <button open-type="share" class="absolute inset-0 h-full w-full border-none bg-transparent opacity-0" style="padding: 0; margin: 0; border: none; background: transparent;" />
      </view>
      <!-- 设置 -->
      <view class="h-64rpx w-64rpx flex items-center justify-center border-[1rpx] border-[#666]/10 rounded-full border-solid bg-white/70" @click="goToSettings">
        <i class="iconfont icon-a-shuxingxianxingmingchengshezhizhuangtaioff text-40rpx text-[#333]" />
      </view>
    </view>
    <!-- 背景图 -->
    <image
      class="fixed left-0 top-0 h-686rpx w-full" :src="userInfo.backgroundUrl || top_bg"
      :mode="userInfo.backgroundUrl ? 'aspectFill' : 'scaleToFill'"
    />
    <!-- 背景图蒙版 -->
    <image
      class="fixed left-0 top-0 h-686rpx w-full" src="/static/images/me_top_bg.png"
      mode="scaleToFill"
    />

    <!-- 固定顶部区域 -->
    <view class="fixed left-0 top-0 z-50 w-full overflow-hidden" :style="{ height: `${statusNavTotalHeight + (isHeaderExpanded ? upx2px(BANNER_HEIGHT_RPX) : 0)}px` }">
      <image
        v-if="!userInfo.backgroundUrl" class="absolute left-0 top-0 h-686rpx w-full" :src="top_bg"
        mode="widthFix"
      />
      <!-- 若有自定义背景，则为了与底层精准重合，采用同样的 absolute 定位尺寸 -->
      <image
        v-if="userInfo.backgroundUrl" class="absolute left-0 top-0 h-686rpx w-full" :src="userInfo.backgroundUrl"
        mode="scaleToFill"
      />
      <image
        class="absolute left-0 top-0 h-686rpx w-full" src="/static/images/me_top_bg.png" mode="scaleToFill"
      />
    </view>

    <!-- 用户信息区域 -->
    <view class="relative z-10 px-30rpx pt-40rpx">
      <!-- 第一行：头像、昵称、设置和分享按钮 -->
      <view class="flex items-start justify-between">
        <!-- 左侧：头像和昵称信息 -->
        <view class="flex items-center gap-20rpx">
          <!-- 头像 -->
          <view class="h-128rpx w-128rpx overflow-hidden rounded-full">
            <image
              class="h-full w-full"
              :src="avatarLoadFailed ? '/static/images/default_picture.png' : (userInfo.avatar || '/static/images/default_picture.png')"
              mode="aspectFill" @error="avatarLoadFailed = true"
            />
          </view>
          <!-- 昵称、ID -->
          <view class="flex flex-col gap-8rpx">
            <text class="max-w-[350rpx] text-36rpx text-[#fff] font-semibold leading-[48rpx]">{{ userInfo.nickname }}</text>
            <view v-if="userInfo.uniqueCode" class="flex items-center gap-4rpx">
              <text class="text-20rpx text-[#999] leading-[28rpx]" @click="copyYuanqiId">Kanoo号：{{ userInfo.uniqueCode }}</text>
              <!-- <image
                class="ml-1 h-24rpx w-24rpx" src="/static/images/qrcode.png" mode="scaleToFill" @click="toQrcode"
              /> -->
              <!-- <view class="h-28rpx w-28rpx flex items-center justify-center" @click="copyYuanqiId">
                <i class="iconfont icon-a-shuxingfuzhizhuangtaion ml-1 text-28rpx text-[#999]" />
              </view> -->
            </view>
          </view>
        </view>
      </view>

      <!-- 性别、年龄、生肖、星座标签 (新的一行) -->
      <view class="mt-24rpx flex items-center gap-16rpx">
        <!-- 性别图标 -->
        <view
          v-if="(userInfo.gender === 1 || userInfo.gender === 2) && userInfo.setting?.genderPublic"
          class="h-44rpx w-44rpx flex flex-none items-center justify-center rounded-full bg-white/10"
          :class="userInfo.gender === 2 ? 'text-[#FF4D4F]' : 'text-[#477FFF]'"
        >
          <i v-if="userInfo.gender === 2" class="iconfont icon-a-shuxingnvxingzhuangtaion text-28rpx" />
          <i v-else-if="userInfo.gender === 1" class="iconfont icon-a-shuxingnanxingzhuangtaion text-28rpx" />
        </view>
        <!-- 年龄标签 -->
        <view
          v-if="userInfo.age != null && userInfo.setting?.birthdayPublic && userInfo.setting?.showAge"
          class="h-44rpx flex flex-none items-center justify-center rounded-full bg-white/10 px-20rpx"
        >
          <text class="text-24rpx text-[#CDCDCD] leading-[28rpx]">年龄：{{ userInfo.age }}</text>
        </view>
        <!-- 生肖 -->
        <view
          v-if="userInfo.zodiac && userInfo.setting?.birthdayPublic && userInfo.setting?.showZodiac"
          class="h-44rpx flex flex-none items-center justify-center rounded-full bg-white/10 px-20rpx"
        >
          <text class="text-24rpx text-[#CDCDCD] leading-[28rpx]">生肖：{{ userInfo.zodiac }}</text>
        </view>
        <!-- 星座 -->
        <view
          v-if="(userInfo.constellation || computedConstellation) && userInfo.setting?.birthdayPublic"
          class="h-44rpx flex flex-none items-center justify-center rounded-full bg-white/10 px-20rpx"
        >
          <text class="text-24rpx text-[#CDCDCD] leading-[28rpx]">星座：{{ userInfo.constellation || computedConstellation }}</text>
        </view>
      </view>

      <view v-if="userInfo.seriesName" class="mt-20rpx flex">
        <view class="h-36rpx flex items-center justify-center border-[1rpx] rounded-[999rpx] bg-[rgba(102,102,102,0.4)] px-20rpx">
          <text class="text-20rpx text-[#CDCDCD]">{{ userInfo.seriesName }}·认证作者</text>
        </view>
      </view>

      <!-- 第二行：关注数、粉丝数 -->
      <view class="mt-30rpx flex items-center justify-between">
        <!-- 左侧：关注数和粉丝数 -->
        <view class="flex items-center gap-48rpx">
          <view class="flex items-baseline gap-8rpx">
            <text class="text-28rpx text-[#fff] font-semibold leading-[40rpx]">{{ followStats.followedCountStr }}</text>
            <text class="text-24rpx text-[#ccc] leading-[32rpx]">关注</text>
          </view>
          <view class="flex items-baseline gap-8rpx">
            <text class="text-28rpx text-[#fff] font-semibold leading-[40rpx]">{{ followStats.fansCountStr }}</text>
            <text class="text-24rpx text-[#ccc] leading-[32rpx]">粉丝</text>
          </view>
          <view class="flex items-baseline gap-8rpx" @click="showLikesFavoritesPopup = true">
            <text class="text-28rpx text-[#fff] font-semibold leading-[40rpx]">{{ followStats.likeAndCollectCountStr }}</text>
            <text class="text-24rpx text-[#ccc] leading-[32rpx]">获赞与收藏</text>
          </view>
        </view>
      </view>

      <!-- 第三行：个人简介 -->
      <view class="mt-20rpx py-20rpx text-24rpx leading-[32rpx]" style="border-top: 1rpx solid rgba(102, 102, 102, 0.1);">
        <view v-if="userInfo.bio" class="relative">
          <view id="bio-text" class="break-all pr-60rpx">
            <text
              class="block text-[#666]"
              :style="!isBioExpanded ? 'overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;' : ''"
            >
              {{ userInfo.bio }}
            </text>
          </view>

          <!-- 用于精确测量完整高度的隐藏元素，避免在可视元素上 toggling 引起闪烁 -->
          <view id="bio-text-hidden" class="pointer-events-none absolute left-0 top-0 break-all pr-60rpx opacity-0 -z-10">
            <text class="block text-[#666]">
              {{ userInfo.bio }}
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
        <text v-else class="text-[#999]" @click="goToEditBio">点击这里，填写简介</text>
      </view>

      <!-- 创作管理和浏览记录 -->
      <view class="mt-30rpx flex items-center justify-between gap-20rpx bg-[transparent]">
        <!-- 创作管理 -->
        <view
          class="h-104rpx flex flex-1 items-center justify-between border-[1rpx] border-[#66666666] rounded-16rpx border-solid bg-white/20 px-20rpx"
          @click="goToCreativeSpace"
        >
          <view class="flex flex-col gap-4rpx">
            <text class="text-24rpx text-[#fff] font-semibold leading-[40rpx]">创作管理</text>
            <text class="text-20rpx text-[#999] leading-[28rpx]">属于你的创作空间</text>
          </view>
          <i class="iconfont icon-a-shuxingchuangzuokongjianzhuangtaion text-40rpx text-white" />
        </view>
        <!-- 浏览记录 -->
        <view
          class="h-104rpx flex flex-1 items-center justify-between border-[1rpx] border-[#6666661A] rounded-16rpx border-solid bg-white/20 px-20rpx"
          @click="goToHistory"
        >
          <view class="flex flex-col gap-4rpx">
            <text class="text-24rpx text-[#fff] font-semibold leading-[40rpx]">浏览记录</text>
            <text class="text-20rpx text-[#999] leading-[28rpx]">看过的创作/作品</text>
          </view>
          <i class="iconfont icon-a-shuxingliulanjiluzhuangtaion text-40rpx text-white" />
        </view>
      </view>
    </view>

    <!-- Banner 区域 -->
    <view
      v-if="userInfo.bannerUrl" class="sticky z-100 mt-24rpx box-border h-160rpx w-full"
      :style="{ top: `${statusNavTotalHeight}px` }"
      @click="goToSeriesDetail(userInfo.seriesId, true)"
    >
      <image class="block h-full w-full" :src="userInfo.bannerUrl" mode="scaleToFill" />
    </view>

    <view class="relative box-border" :class="userInfo.bannerUrl ? 'mt-[-24rpx]' : 'mt-16rpx'">
      <!-- 标签栏容器：粘性布局 -->
      <view class="sticky z-101 rounded-t-24rpx bg-white" :style="{ top: `${statusNavTotalHeight + (userInfo.bannerUrl ? upx2px(BANNER_HEIGHT_RPX) - upx2px(24) : 0)}px` }">
        <!-- 第一行标签：创作/收藏 -->
        <view class="px-16rpx">
          <view class="main-tabs__nav relative flex items-center">
            <view
              v-for="(tab, index) in mainTabs" :id="`main-tab-${index}`" :key="index"
              class="h-84rpx flex flex-none items-center justify-center px-20rpx py-0 transition-colors duration-300"
              @click="handleMainTabClick(index)"
            >
              <text
                class="transition-all duration-300"
                :class="currentMainTab === index ? 'text-32rpx text-[#181818] font-bold' : 'text-32rpx text-[#999] font-normal'"
              >
                {{ tab }}
              </text>
            </view>
            <!-- 下划线指示器 -->
            <view
              class="absolute bottom-0 h-4rpx rounded-2rpx bg-[#181818] transition-left duration-300" :style="{
                width: `${mainTabLineWidth}px`,
                left: `${mainTabLineLeft}px`,
              }"
            />
          </view>
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
            v-if="currentMainTab === 2 || (currentMainTab === 0 && currentSubTabName !== '合集') || (currentMainTab === 1 && currentSubTabName !== 'IP系列')"
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
      <view class="pointer-events-none sticky left-0 w-full" :style="{ height: '0', top: `${statusNavTotalHeight + (userInfo.bannerUrl ? upx2px(BANNER_HEIGHT_RPX) : 0) + upx2px(STICKY_TAB_BAR_HEIGHT_RPX)}px` }">
        <view class="w-full" :style="{ height: '80rpx', background: 'linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0))' }" />
      </view>

      <!-- 内容区域 -->
      <view v-if="isShowCollection && !isIpSeriesOffShelf" class="mt-[-2rpx] bg-[#f5f5f5] pt-[16rpx]" :style="listSectionMinHeightStyle">
        <IpCollectionList
          v-if="collectionList.length > 0" :list="collectionList" :has-more="false" mode="collection"
          :show-password="false" @handle-click="toCollectionAssets"
        />
        <fg-empty v-else :full-height="false" />
        <!-- 底部提示：合集Tab有数据时显示（合集一次性加载，无需分页） -->
        <view v-if="collectionList.length > 0" class="py-40rpx text-center text-24rpx text-gray-400">
          - 到底了 -
        </view>
      </view>
      <view v-else-if="isShowIpSeries" class="mt-[-2rpx] box-border bg-[#f5f5f5] px-20rpx pt-[16rpx]" :style="listSectionMinHeightStyle">
        <view v-if="ipSeriesFavorites.length > 0 || ipSeriesPage.loading" class="relative mt-16rpx box-border">
          <IpSeriesGridWaterfall :list="ipSeriesFavorites" @item-click="goToSeriesDetail" />

          <view class="flex items-center justify-center py-[30rpx]">
            <text v-if="ipSeriesPage.loading" class="text-24rpx text-[#999]">加载中...</text>
            <text v-else-if="!ipSeriesPage.hasMore" class="text-24rpx text-[#999]">- 到底了 -</text>
          </view>
        </view>
        <fg-empty v-else :full-height="false" />
      </view>
      <view v-else class="mt-[-2rpx] bg-[#f5f5f5] pt-[16rpx]" :style="listSectionMinHeightStyle">
        <FgWaterfall v-if="waterfallData.length > 0 || pageState.loading" :list="waterfallData" :has-top-label="true" :scene="currentMainTab === 0 ? '2' : '1'" @item-click="handleWaterfallItemClick" @asset-invalid="handleAssetInvalid" @all-images-loaded="isWaterfallImagesLoaded = true" />
        <!-- 失效素材清理提示：仅在收藏/赞过Tab下，且有失效素材时显示 -->
        <view
          v-if="currentMainTab !== 0 && invalidAssetCount > 0 && !pageState.hasNext && !pageState.loading"
          class="px-32rpx py-32rpx text-center text-24rpx text-[#999] leading-[40rpx]"
        >
          <text>由于素材被删除或下架，{{ invalidAssetCount }}个素材不可见</text>
          <text class="ml-16rpx text-[#181818] font-bold" style="text-decoration: underline;" @click="showCleanupDialog = true">点击清理</text>
        </view>
        <!-- 底部提示：有数据、没有下一页、且图片全部加载完成时显示 -->
        <view
          v-if="waterfallData.length > 0 && !pageState.hasNext && !pageState.loading && isWaterfallImagesLoaded && invalidAssetCount === 0"
          class="py-40rpx text-center text-24rpx text-gray-400"
        >
          - 到底了 -
        </view>
        <fg-empty v-if="waterfallData.length === 0 && !pageState.loading" :full-height="false" />
      </view>
    </view>

    <!-- 手机号登录提示弹窗 -->
    <PhoneLoginPopup
      v-model:show="showPhoneLoginAlert"
      @confirm="onGoToPhoneLogin"
    />

    <!-- 清理失效素材确认弹窗 -->
    <ConfirmPopup
      v-model:visible="showCleanupDialog"
      title="清理全部失效素材"
      message="点击清理后，将清除列表中所有失效的素材"
      confirm-text="清理"
      @confirm="handleCleanup"
    />

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
              <text class="text-44rpx text-[#333] font-semibold">{{ followStats.contentCountStr }}</text>
              <text class="mt-16rpx text-24rpx text-[#999]">当前发布作品数</text>
            </view>
            <view class="flex flex-1 flex-col items-center rounded-16rpx bg-[#F5F5F5] p-36rpx">
              <text class="text-44rpx text-[#333] font-semibold">{{ followStats.assetCountStr }}</text>
              <text class="mt-16rpx text-24rpx text-[#999]">当前发布图库数</text>
            </view>
          </view>
          <view class="mt-24rpx flex gap-20rpx">
            <view class="flex flex-1 flex-col items-center rounded-16rpx bg-[#F5F5F5] p-36rpx">
              <text class="text-44rpx text-[#333] font-semibold">{{ followStats.receivedLikeCountStr }}</text>
              <text class="mt-16rpx text-24rpx text-[#999]">当前获得点赞数</text>
            </view>
            <view class="flex flex-1 flex-col items-center rounded-16rpx bg-[#F5F5F5] p-36rpx">
              <text class="text-44rpx text-[#333] font-semibold">{{ followStats.receivedCollectCountStr }}</text>
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
// 下划线过渡动画
.transition-left {
  transition: left 0.3s ease;
}

// 清理弹窗动画
.cleanup-dialog {
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

/* 临时验证：对齐 IP 系列页直接使用 u-waterfall 的列宽配置 */
:deep(.u-waterfall) {
  width: 720rpx !important;
  gap: 16rpx;
  margin: 0 auto;
}

:deep(.u-waterfall .u-column) {
  flex: none !important;
  width: 352rpx !important;
}
</style>
