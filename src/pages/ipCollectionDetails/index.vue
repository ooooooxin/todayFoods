<script lang="ts" setup>
import type { IpAssetItem, ListAssetByIpItem } from '@/api/ip/ip'
import type { MyCollectionItem } from '@/api/me/me'
import type { SimpleIpItem } from '@/store/ipCollection'
import { onHide, onLoad, onPageScroll, onReachBottom, onShow } from '@dcloudio/uni-app'
import { nextTick, onMounted, ref } from 'vue'
// import { statsAction } from '@/api/common/index'
import { getCollectionAssets, getIps, listAssetByIp } from '@/api/ip/ip'
import {
  getCreatorCollectionList,
} from '@/api/me/me'
import { useCategoryFilter } from '@/composables/useCategoryFilter'
import { usePageScrollBridge } from '@/hooks/usePageScrollBridge'
import { useIpCollectionStore } from '@/store/ipCollection'
import { usePageScrollStore } from '@/store/pageScroll'
import { useTokenStore } from '@/store/token'
import { useWorksDetailsStore } from '@/store/worksDetails'
import { statusNavTotalHeight } from '@/utils/systemInfo'

const worksDetailsStore = useWorksDetailsStore()
const ipCollectionStore = useIpCollectionStore()
const tokenStore = useTokenStore()
const pageScrollStore = usePageScrollStore()
usePageScrollBridge()

const customToTopBottom = ref('')

// 空状态文本
const emptyText = ref('')

// IP已下架状态
const isOffline = ref(false)

definePage({
  style: {
    navigationBarTitleText: '',
  },
})

// IP ID（从上个页面传过来）- 保持字符串类型避免精度丢失
const ipId = ref<string>()

// 互动分数（从上个页面传过来，用于加载IP列表）
const interactionScore = ref<string>()

// 创作者ID（从上个页面传过来，用于加载IP列表）
const creatorId = ref<string>()

// 系列ID（从上个页面传过来，用于加载IP列表）
const seriesId = ref<string>()

// 搜索关键词（从IP列表页跳转时传递，用于加载IP列表）
const keyword = ref<string>()

// 使用 composable 管理一级和二级分类（跟随变更）
const categoryFilter = useCategoryFilter({
  enableSubTabSync: true,
})

// 当前选中标签的名称
const currentTabName = ref('图库')

// 是否从创作者跳转（该创作者为认证作者，展示底部switchTab）
const isFromCreator = ref(false)

// 创作者等级（从creatorDetails页面传入）
const creatorLevel = ref<number>()

// 是否显示顶部标签：如果从创作者页面跳转，使用creatorLevel判断；否则使用userInfo.level判断
const hasTopLabel = computed(() => {
  if (isFromCreator.value && creatorLevel.value !== undefined) {
    return creatorLevel.value === 4
  }
  return false
})

// 瀑布流数据
const waterfallData = ref<ListAssetByIpItem[]>([])

// ==================== 素材列表分页 ====================
// 分页游标
const nextCursorId = ref(0)
const nextCursorScore = ref(0)
const hasMore = ref(true)

// ==================== IP列表轮播分页 ====================
// 缓存所有IP数据（用于前后分页）
const allIpData = ref<IpAssetItem[]>([])
// 当前显示的IP数据（用于轮播）
const displayIpData = ref<IpAssetItem[]>([])
// IP列表分页游标
const prevCursorId = ref('')
const prevCursorScore = ref('')
const nextIpCursorId = ref('')
const nextIpCursorScore = ref('')
const hasPrev = ref(false)
const hasNextIp = ref(false)
const isLoadingPrev = ref(false)
const isLoadingNext = ref(false)
// 初始加载完成标志
const initialLoadDone = ref(false)
// 轮播动画是否完成
const isSwiperAnimationComplete = ref(true)
// 是否正在处理轮播切换
let isProcessingSwiperChange = false

// 加载状态
const isLoading = ref(false)
// 素材列表是否已完成至少一次加载（用于控制空状态展示）
const assetListLoaded = ref(false)
// 瀑布流图片是否全部加载完成
const isWaterfallImagesLoaded = ref(false)

// 排序选项
const sortOptions = ['热门', '最新']
const currentSort = ref('热门')
const isSortOpen = ref(false)

// ==================== 圆形Tab轮播组件（Swiper实现） ====================
// IP列表数据（从listIpAssets接口获取）
const circleTabs = ref<IpAssetItem[]>([])

// 当前可视区起始索引（控制 swiper 滚动位置）
const circleTabScrollIndex = ref(0)

const displayMultipleItems = computed(() => Math.min(5, circleTabs.value.length))

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

// 视觉激活的Tab索引（控制样式，不影响swiper位置）
const visualActiveCircleTabIndex = ref(0)

const upx2px = (rpx: number) => uni.upx2px(rpx)

// Swiper切换事件
async function onSwiperChange(e: any) {
  if (isProcessingSwiperChange)
    return
  isProcessingSwiperChange = true
  isSwiperAnimationComplete.value = false

  const newIndex = e.detail.current
  const oldIndex = circleTabScrollIndex.value

  circleTabScrollIndex.value = newIndex

  const direction = newIndex > oldIndex ? 'forward' : 'backward'

  nextTick(() => {
    isProcessingSwiperChange = false
    setTimeout(() => {
      isSwiperAnimationComplete.value = true
      if (direction === 'forward') {
        checkIpLoadMore()
      }
    }, 300)
  })
  // 向后滚动（索引变大）且接近末尾时，加载更多NEXT数据
  if (direction === 'forward' && newIndex >= displayIpData.value.length - 5 && hasNextIp.value && !isLoadingNext.value) {
    fetchIpListData('NEXT', {
      id: nextIpCursorId.value,
      score: nextIpCursorScore.value,
    })
  }

  // 向前滚动（索引变小）且接近开头时，加载更多PREV数据
  if (direction === 'backward' && newIndex <= 5 && hasPrev.value && !isLoadingPrev.value) {
    fetchIpListData('PREV', {
      id: prevCursorId.value,
      score: prevCursorScore.value,
    })
  }
}

// 点击Tab切换
function onSwiperTabClick(index: number) {
  if (index === visualActiveCircleTabIndex.value)
    return
  visualActiveCircleTabIndex.value = index

  // 点击切换会先于 swiper change 触发，需在首次加载前重置筛选。
  closeSort()
  categoryFilter.resetAll()

  // 切换后重新加载素材列表
  switchIpAndLoadAssets(index)

  uni.pageScrollTo({ scrollTop: 0 })
}

// 切换锁，防止重复触发
let isSwitching = false

// 切换IP并重新加载素材列表
async function switchIpAndLoadAssets(index: number) {
  // 如果正在切换中，直接返回
  if (isSwitching)
    return
  isSwitching = true

  const selectedTab = circleTabs.value[index]
  if (selectedTab && selectedTab.id) {
    ipId.value = selectedTab.id
    // 更新头部标题为当前选中的IP名称
    currentTabName.value = selectedTab.name || '图库'
    // 重置分页状态，分类筛选由切换入口统一处理
    nextCursorId.value = 0
    nextCursorScore.value = 0
    hasMore.value = true
    // waterfallData.value = []
    // 重新加载素材列表，并上报
    loadAssetList(false, true).finally(() => {
      // 加载完成后解锁
      isSwitching = false
    })
  }
  else {
    isSwitching = false
  }
}

// 切换标签
function handleTabClick(index: number) {
  const tab = categoryFilter.tabs.value[index]
  if (!tab)
    return
  // 切换 tab 时隐藏下拉菜单
  closeSort()
  categoryFilter.selectTab(tab.id)
  uni.pageScrollTo({ scrollTop: 0 })
  loadAssetList()
}

// 切换二级标签
function handleSubTabClick(index: number) {
  const tab = categoryFilter.subTabs.value[index]
  if (!tab)
    return
  // 切换 tab 时隐藏下拉菜单
  closeSort()
  categoryFilter.selectSubTab(tab.id)
  uni.pageScrollTo({ scrollTop: 0 })
  loadAssetList()
}

function toggleSort() {
  isSortOpen.value = !isSortOpen.value
}

// 隐藏排序下拉
function closeSort() {
  if (isSortOpen.value) {
    isSortOpen.value = false
  }
}

function selectSort(option: string) {
  currentSort.value = option
  isSortOpen.value = false
  uni.pageScrollTo({ scrollTop: 0 })
  loadAssetList()
}

// 加载素材列表
async function loadAssetList(loadMore = false, needReport = false) {
  if (loadMore && !hasMore.value)
    return
  if (!ipId.value)
    return

  if (!loadMore)
    assetListLoaded.value = false
  isLoading.value = true
  // 重置图片加载状态
  isWaterfallImagesLoaded.value = false
  try {
    let data: any
    if (isFromCreator.value) {
      // 从创作者跳转，调用合集素材接口,加上分类
      const params = {
        category: categoryFilter.currentTabId.value ? Number(categoryFilter.currentTabId.value) : undefined,
        fileType: categoryFilter.currentSubTabId.value ? Number(categoryFilter.currentSubTabId.value) : undefined,
        pageSize: 20,
        collectionId: ipId.value,
        sortType: creatorLevel.value === 4 ? (currentSort.value === '热门' ? 1 : 2) as 1 | 2 : 0,
        ...(loadMore ? { cursorId: nextCursorId.value, cursorSort: nextCursorScore.value } : {}),
      }
      const res = await getCollectionAssets(params)
      data = {
        records: res.records,
        nextCursorId: res.nextCursorId,
        nextCursorScore: res.nextCursorSort,
        hasNext: res.hasNext,
      }
    }
    else {
      // 正常IP素材列表
      const params = {
        pageSize: 20,
        ipId: ipId.value,
        sortType: (currentSort.value === '热门' ? 1 : 2) as 1 | 2,
        category: categoryFilter.currentTabId.value ? Number(categoryFilter.currentTabId.value) : undefined,
        fileType: categoryFilter.currentSubTabId.value ? Number(categoryFilter.currentSubTabId.value) : undefined,
        ...(loadMore ? { cursorId: nextCursorId.value, hotScore: nextCursorScore.value } : {}),
      }
      data = await listAssetByIp<ListAssetByIpItem>(params)
    }

    if (loadMore) {
      waterfallData.value = [...waterfallData.value, ...data.records]
    }
    else {
      waterfallData.value = data.records
    }

    nextCursorId.value = data.nextCursorId || 0
    nextCursorScore.value = data.nextCursorScore || 0
    hasMore.value = data.hasNext

    emptyText.value = ''

    // 上报查看操作
    // if (needReport && tokenStore.hasLogin) {
    //   statsAction({
    //     entityType: 'IP',
    //     contentId: ipId.value || '',
    //     actionType: 'VIEW',
    //   })
    // }
    isOffline.value = false
  }
  catch (error: any) {
    console.error('获取素材列表失败:', error)
    isOffline.value = true
    emptyText.value = (error?.code === 4005 || error?.code === 4002) ? '该IP暂不可访问' : error?.message || ''
    waterfallData.value = []
  }
  finally {
    isLoading.value = false
    if (!loadMore)
      assetListLoaded.value = true
  }
}

onMounted(() => {
})

onUnload(() => {
  ipCollectionStore.clearAll()
})

// 触底加载更多（页面级）
onReachBottom(() => {
  if (!isWaterfallImagesLoaded.value)
    return
  loadAssetList(true)
})

onShow(() => {
  pageScrollStore.setToTopBottom(customToTopBottom.value)
  setTimeout(() => {
    if (uni.getStorageSync('needRefreshFromException') === '1') {
      uni.removeStorageSync('needRefreshFromException')
      // 重置数据状态
      assetListLoaded.value = false
      waterfallData.value = []
      circleTabs.value = []
      allIpData.value = []
      displayIpData.value = []
      // 从异常返回时，重新获取页面参数（防止页面被重建后参数丢失）
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1] as any
      const options = currentPage?.options || currentPage?.$page?.options || {}
      if (options?.seriesId) {
        seriesId.value = options.seriesId
      }
      if (options?.id) {
        ipId.value = options.id
      }
      if (options?.interactionScore) {
        interactionScore.value = options.interactionScore
      }
      // 从异常返回时，不清除store，保留storeItem用于loadPageData
      loadPageData(true)
    }
  }, 100)
})

// 页面隐藏时隐藏下拉菜单
onHide(() => {
  closeSort()
})

// 页面滚动时隐藏下拉菜单
onPageScroll(() => {
  if (isSortOpen.value) {
    isSortOpen.value = false
  }
})

// 加载IP列表
async function loadIpList(initialIpId?: string) {
  if (!initialIpId) {
    await loadIpListWithoutCursor()
    return
  }

  if (isFromCreator.value) {
    await loadCreatorCollectionList(initialIpId)
    return
  }

  try {
    // 从 Store 获取当前IP的interactionScore
    const storeItem = ipCollectionStore.currentIpItem
    const interactionScore = storeItem?.interactionScore ? Number(storeItem.interactionScore) : undefined

    const firstPageData = await getIps({
      seriesId: seriesId.value,
      keyword: keyword.value,
      pageSize: 10,
    })

    const records = firstPageData.records
    const matchedIndex = records.findIndex(item => item.id === initialIpId)

    if (matchedIndex !== -1) {
      circleTabs.value = records
      allIpData.value = [...records]
      displayIpData.value = [...records]
      prevCursorId.value = firstPageData.prevCursorId || ''
      prevCursorScore.value = firstPageData.prevCursorScore || ''
      nextIpCursorId.value = firstPageData.nextCursorId || ''
      nextIpCursorScore.value = firstPageData.nextCursorScore || ''
      hasPrev.value = firstPageData.hasPrev
      hasNextIp.value = firstPageData.hasNext

      circleTabScrollIndex.value = getCircleTabScrollIndex(matchedIndex)
      visualActiveCircleTabIndex.value = matchedIndex
      ipId.value = initialIpId
      initialLoadDone.value = true
      loadAssetList(false, true)
    }
    else {
      // 使用从Store获取的interactionScore调用loadIpListWithCursor
      await loadIpListWithCursor(initialIpId, interactionScore)
    }
  }
  catch (error) {
    console.error('获取IP列表失败:', error)
  }
}

function convertMyCollectionToIpAsset(item: MyCollectionItem): IpAssetItem {
  return {
    id: String(item.id),
    name: item.title,
    avatarImgUrl: item.avatarImgUrl || null,
    desImgUrl: null,
    mainImgBakUrl: null,
    mainImgUrl: null,
    totalInteraction: '',
    totalInteractionFormatted: '',
    popularity: '',
    popularityStr: '',
    previewAssets: null,
    assetTotal: item.assetCount ?? null,
    assetTotalFormatted: item.assetCountFormatted || '',
  }
}

async function loadCreatorCollectionList(initialIpId?: string) {
  try {
    const data = await getCreatorCollectionList(creatorId.value)
    const records = data.records.map(convertMyCollectionToIpAsset)

    circleTabs.value = records
    allIpData.value = [...records]
    displayIpData.value = [...records]

    const matchedIndex = initialIpId ? records.findIndex(item => item.id === initialIpId) : 0
    const targetIndex = matchedIndex !== -1 ? matchedIndex : 0

    circleTabScrollIndex.value = getCircleTabScrollIndex(targetIndex)
    visualActiveCircleTabIndex.value = targetIndex
    ipId.value = records[targetIndex]?.id
    initialLoadDone.value = true
    loadAssetList(false, true)
  }
  catch (error) {
    console.error('获取创作者合集列表失败:', error)
  }
}

// 不带cursor的初始加载（没有initialIpId时）
async function loadIpListWithoutCursor() {
  if (isFromCreator.value) {
    await loadCreatorCollectionList()
    return
  }

  try {
    const data = await getIps({
      seriesId: seriesId.value,
      keyword: keyword.value,
      pageSize: 10,
    })

    circleTabs.value = data.records
    allIpData.value = [...data.records]
    displayIpData.value = [...data.records]
    prevCursorId.value = data.prevCursorId || ''
    prevCursorScore.value = data.prevCursorScore || ''
    nextIpCursorId.value = data.nextCursorId || ''
    nextIpCursorScore.value = data.nextCursorScore || ''
    hasPrev.value = data.hasPrev
    hasNextIp.value = data.hasNext

    if (circleTabs.value.length > 0) {
      circleTabScrollIndex.value = 0
      visualActiveCircleTabIndex.value = 0
      ipId.value = circleTabs.value[0].id
      initialLoadDone.value = true
      loadAssetList(false, true)
    }
  }
  catch (error) {
    console.error('获取IP列表失败:', error)
  }
}

// 带item数据的加载（从上一个页面传入的item，直接加载前后页数据）
async function loadIpListWithItem(initialIpId: string, currentItem: SimpleIpItem) {
  try {
    const interactionScore = currentItem.interactionScore ? Number(currentItem.interactionScore) : undefined
    const [prevData, nextData] = await Promise.all([
      getIps({
        seriesId: seriesId.value,
        direction: 'PREV',
        cursorId: initialIpId,
        interactionScore,
        keyword: keyword.value,
        pageSize: 10,
      }),
      getIps({
        seriesId: seriesId.value,
        direction: 'NEXT',
        cursorId: initialIpId,
        interactionScore,
        keyword: keyword.value,
        pageSize: 10,
      }),
    ])

    const prevRecords = prevData.records
    const nextRecords = nextData.records

    if (!currentItem) {
      await loadIpListWithoutCursor()
      return
    }

    // 将 SimpleIpItem 转换为 IpAssetItem
    const currentIpItem: IpAssetItem = {
      id: currentItem.id,
      name: currentItem.name,
      avatarImgUrl: currentItem.avatarImgUrl || null,
      desImgUrl: null,
      mainImgBakUrl: null,
      mainImgUrl: null,
      totalInteraction: currentItem.interactionScore || '',
      totalInteractionFormatted: '',
      popularity: '',
      popularityStr: '',
      previewAssets: null,
      assetTotal: null,
      assetTotalFormatted: '',
    }

    const combinedRecords = [...prevRecords, currentIpItem, ...nextRecords]
    circleTabs.value = combinedRecords
    allIpData.value = [...combinedRecords]
    displayIpData.value = [...combinedRecords]

    prevCursorId.value = prevData.prevCursorId || ''
    prevCursorScore.value = prevData.prevCursorScore || ''
    hasPrev.value = prevData.hasPrev

    nextIpCursorId.value = nextData.nextCursorId || ''
    nextIpCursorScore.value = nextData.nextCursorScore || ''
    hasNextIp.value = nextData.hasNext

    const targetIndex = prevRecords.length
    circleTabScrollIndex.value = getCircleTabScrollIndex(targetIndex)
    visualActiveCircleTabIndex.value = targetIndex
    ipId.value = initialIpId
    initialLoadDone.value = true

    loadAssetList(false, true)
  }
  catch (error) {
    console.error('获取IP列表失败:', error)
  }
}

// 带cursor的加载（从初始id处向前向后加载数据）
async function loadIpListWithCursor(initialIpId: string, initialInteractionScore?: number | string) {
  try {
    // 从 Store 获取当前IP数据
    const storeItem = ipCollectionStore.currentIpItem
    // 使用传入的interactionScore或从Store获取
    const interactionScore = initialInteractionScore ?? (storeItem?.interactionScore ? Number(storeItem.interactionScore) : undefined)

    const [prevData, nextData] = await Promise.all([
      getIps({
        seriesId: seriesId.value,
        direction: 'PREV',
        cursorId: initialIpId,
        interactionScore,
        keyword: keyword.value,
        pageSize: 10,
      }),
      getIps({
        seriesId: seriesId.value,
        direction: 'NEXT',
        cursorId: initialIpId,
        interactionScore,
        keyword: keyword.value,
        pageSize: 10,
      }),
    ])

    const prevRecords = prevData.records
    const nextRecords = nextData.records

    // 从返回数据中获取当前IP项
    const currentItem = [...prevRecords, ...nextRecords].find(item => item.id === initialIpId)

    if (!currentItem) {
      await loadIpListWithoutCursor()
      return
    }

    const combinedRecords = [...prevRecords, currentItem, ...nextRecords]

    circleTabs.value = combinedRecords
    allIpData.value = [...combinedRecords]
    displayIpData.value = [...combinedRecords]

    prevCursorId.value = prevData.prevCursorId || ''
    prevCursorScore.value = prevData.prevCursorScore || ''
    hasPrev.value = prevData.hasPrev

    nextIpCursorId.value = nextData.nextCursorId || ''
    nextIpCursorScore.value = nextData.nextCursorScore || ''
    hasNextIp.value = nextData.hasNext

    const targetIndex = prevRecords.length
    circleTabScrollIndex.value = getCircleTabScrollIndex(targetIndex)
    visualActiveCircleTabIndex.value = targetIndex
    ipId.value = initialIpId
    initialLoadDone.value = true

    loadAssetList(false, true)
  }
  catch (error) {
    console.error('获取IP列表失败:', error)
  }
}

// ==================== IP列表分页核心方法 ====================
type Direction = 'NEXT' | 'PREV'

async function fetchIpListData(
  direction: Direction,
  cursor?: { id?: string, score?: string },
): Promise<void> {
  const isNext = direction === 'NEXT'
  if (isNext) {
    if (isLoadingNext.value || !hasNextIp.value)
      return
    isLoadingNext.value = true
  }
  else {
    if (isLoadingPrev.value || !hasPrev.value)
      return
    isLoadingPrev.value = true
  }

  try {
    const params = {
      seriesId: seriesId.value,
      direction,
      cursorId: cursor?.id,
      interactionScore: cursor?.score ? cursor.score : undefined,
      keyword: keyword.value,
      pageSize: 10,
    }

    const data = await getIps(params)

    if (isNext) {
      nextIpCursorId.value = data.nextCursorId || ''
      nextIpCursorScore.value = data.nextCursorScore || ''
      hasNextIp.value = data.hasNext

      const newData = data.records
      allIpData.value = [...allIpData.value, ...newData]
      displayIpData.value = [...displayIpData.value, ...newData]
      circleTabs.value = [...circleTabs.value, ...newData]
    }
    else {
      prevCursorId.value = data.prevCursorId || ''
      prevCursorScore.value = data.prevCursorScore || ''
      hasPrev.value = data.hasPrev

      const newData = data.records
      const newDataLength = newData.length
      allIpData.value = [...newData, ...allIpData.value]
      displayIpData.value = [...newData, ...displayIpData.value]
      circleTabs.value = [...newData, ...circleTabs.value]
      // 同步调整当前窗口和选中索引，因为前面插入了新数据
      circleTabScrollIndex.value = circleTabScrollIndex.value + newDataLength
      visualActiveCircleTabIndex.value = visualActiveCircleTabIndex.value + newDataLength
    }
  }
  catch (error) {
    console.error('获取IP列表失败:', error)
  }
  finally {
    if (isNext) {
      isLoadingNext.value = false
    }
    else {
      isLoadingPrev.value = false
    }
  }
}

// 检查是否需要加载更多数据
function checkIpLoadMore() {
  if (!isSwiperAnimationComplete.value) {
    return
  }

  const currentIndex = circleTabScrollIndex.value
  const totalCount = displayIpData.value.length

  if (currentIndex >= totalCount - 5 && hasNextIp.value && !isLoadingNext.value) {
    fetchIpListData('NEXT', {
      id: nextIpCursorId.value,
      score: nextIpCursorScore.value,
    })
  }

  if (currentIndex <= 5 && hasPrev.value && !isLoadingPrev.value) {
    fetchIpListData('PREV', {
      id: prevCursorId.value,
      score: prevCursorScore.value,
    })
  }
}

// 页面加载时获取参数并加载数据
onLoad((options) => {
  isFromCreator.value = options?.fromCreator === '1'
  seriesId.value = options.seriesId || ''
  if (options?.id) {
    ipId.value = options.id
  }
  if (options?.interactionScore) {
    interactionScore.value = options.interactionScore
  }
  if (options?.creatorId) {
    creatorId.value = options.creatorId
  }
  if (options?.creatorLevel) {
    creatorLevel.value = Number(options.creatorLevel)
  }
  if (options?.keyword) {
    keyword.value = decodeURIComponent(options.keyword)
  }

  // 设置页面标题
  if (options?.title) {
    currentTabName.value = decodeURIComponent(options.title)
  }
  loadPageData()
})

function loadPageData(isFromException = false) {
  // 从 Store 获取传递的IP数据
  const storeItem = ipCollectionStore.currentIpItem
  // 从options获取interactionScore（如果从其他页面通过URL参数传递）
  const passedInteractionScore = interactionScore.value || storeItem?.interactionScore
  let passedItemData: SimpleIpItem | null = null
  if (storeItem) {
    passedItemData = {
      id: storeItem.id,
      name: storeItem.name,
      avatarImgUrl: storeItem.avatarImgUrl,
      interactionScore: passedInteractionScore,
    }
  }
  if (passedItemData) {
    // 如果Store中有IP数据，直接使用该数据加载前后页数据
    loadIpListWithItem(ipId.value, passedItemData)
  }
  else {
    // 先加载IP列表，匹配后再加载素材
    loadIpList(ipId.value)
  }
}

// 处理瀑布流item点击
function handleWaterfallItemClick(item: any, index: number, detail: any) {
  worksDetailsStore.setEntrySource('ipCollection')
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
  loadAssetList(false, true)
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
</script>

<template>
  <view class="h-screen flex flex-col">
    <!-- 第一行：CommonHeader -->
    <CommonHeader mode="auto" :scroll-top="0" />
    <!-- 第二行：CustomTitle -->
    <custom-title :text="currentTabName" text-color="text-white" />

    <image
      class="fixed left-0 top-0 z-1 w-full"
      :style="{ height: `${statusNavTotalHeight + upx2px(192) + upx2px(32)}px` }"
      src="/static/images/bg_logo_black.png"
      mode="scaleToFill"
    />

    <!-- 顶部Tab轮播组件（Swiper实现） -->
    <view class="fixed left-0 right-0 z-100 h-192rpx overflow-hidden" :style="{ top: `${statusNavTotalHeight}px` }">
      <!-- 少于等于 5 个时用固定 5 槽布局，避免 swiper 自动平分导致分散排布 -->
      <view v-if="circleTabs.length <= 5" class="relative z-2 h-full w-full flex">
        <view v-for="(tab, index) in circleTabs" :key="tab.id" class="h-full flex flex-col items-center pt-16rpx" style="width: 20%;">
          <view
            class="h-136rpx w-136rpx flex items-center justify-center transition-all duration-300" @click="onSwiperTabClick(index)"
          >
            <view class="border-[4rpx] rounded-[12rpx] border-solid p-[4rpx] transition-colors duration-200" :style="{ borderColor: visualActiveCircleTabIndex === index ? '#fff' : 'transparent' }">
              <ImagePlaceholder :src="tab.avatarImgUrl" mode="aspectFill" class-name="h-[100rpx] w-[100rpx] rounded-[8rpx]" />
            </view>
          </view>
          <text class="w-[100rpx] truncate text-center text-[20rpx] text-white leading-[36rpx]" :class="visualActiveCircleTabIndex === index ? 'font-semibold' : ''">
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
            <view class="border-[4rpx] rounded-[12rpx] border-solid p-[4rpx] transition-colors duration-200" :style="{ borderColor: visualActiveCircleTabIndex === index ? '#fff' : 'transparent' }">
              <ImagePlaceholder :src="tab.avatarImgUrl" mode="aspectFill" class-name="h-[100rpx] w-[100rpx] rounded-[8rpx]" />
            </view>
          </view>
          <text class="w-[100rpx] truncate text-center text-[20rpx] text-white leading-[36rpx]" :class="visualActiveCircleTabIndex === index ? 'font-semibold' : ''">
            {{ tab.name }}
          </text>
        </swiper-item>
      </swiper>
    </view>

    <!-- IP已下架展示空状态 -->
    <fg-empty v-if="isOffline" type="content" :text="emptyText" class="flex-1" />

    <template v-else>
      <!-- 第三行：筛选栏 -->
      <view
        class="fixed left-0 right-0 z-30 rounded-tl-[32rpx] rounded-tr-[32rpx] bg-[#fff] pb-2 pl-10rpx pr-30rpx"
        :style="{ top: `${statusNavTotalHeight + upx2px(192)}px` }"
      >
        <view class="h-[86rpx] flex items-center justify-between">
          <!-- 左侧 Tabs -->
          <u-tabs
            class="mr-4 min-w-0 flex-1 overflow-hidden rounded-[28rpx]"
            :list="categoryFilter.tabs.value"
            :is-scroll="true"
            item-width="100"
            gutter="0"
            active-color="#181818"
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
                class="flex items-center justify-between px-4 py-2 text-sm active:bg-gray-100" :class="[
                  currentSort === option ? 'text-black font-bold' : 'text-gray-500',
                  index !== sortOptions.length - 1 ? 'border-b border-[rgba(102,102,102,0.1)]' : '',
                ]" @click="selectSort(option)"
              >
                <span>{{ option }}</span>
                <view v-if="currentSort === option" class="i-carbon-checkmark text-24rpx text-[#181818]" />
              </view>
            </view>
          </view>
        </view>

        <!-- 二级分类 -->
        <view v-if="categoryFilter.hasSubTabs.value" class="mt-2 h-[56rpx] flex items-center gap-2 pl-12rpx">
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

      <view class="pointer-events-none fixed left-0 w-full" :style="{ top: `${statusNavTotalHeight + upx2px(192) + (categoryFilter.hasSubTabs.value ? upx2px(174) : upx2px(102))}px` }" style="height: 80rpx; background: linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0));" />
      <!-- 第四行：瀑布流区域 -->
      <view
        v-if="waterfallData.length > 0"
        class="box-border flex-1 pt-24rpx"
        :style="{ paddingTop: `${upx2px(192) + (categoryFilter.hasSubTabs.value ? upx2px(174) : upx2px(102))}px` }"
      >
        <FgWaterfall
          :list="waterfallData"
          scene="2"
          :has-top-label="hasTopLabel"
          @item-click="handleWaterfallItemClick"
          @asset-invalid="handleAssetInvalid"
          @all-images-loaded="isWaterfallImagesLoaded = true"
        />
        <!-- 底部提示：有数据、没有下一页、且图片全部加载完成时显示 -->
        <view v-if="!hasMore && !isLoading && isWaterfallImagesLoaded" class="py-40rpx text-center text-24rpx text-gray-400">
          - 到底了 -
        </view>
      </view>
      <fg-empty v-if="assetListLoaded && waterfallData.length === 0" type="content" class="flex-1" />
    </template>
  </view>
</template>

<style scoped lang="scss"></style>
