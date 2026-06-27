<script lang="ts" setup>
import type { MyAssetsDetail } from '@/api/common'
import { onHide, onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getAuditList } from '@/api/auditCenter/auditCenter'
import { getMyAssetsDetail } from '@/api/common'
import {
  bottomAsset,
  bottomMyAsset,
  cancelTopAsset,
  cancelTopMyAsset,
  deleteBatchAssets,
  removeAssetsFromCollection,
  topAsset,
  topMyAsset,
} from '@/api/creativeSpace/creativeSpace'
import { getCollectionAssets } from '@/api/ip/ip'
import { getMyAssetList } from '@/api/me/me'
import BottomTabBar from '@/components/bottom-tab-bar/bottom-tab-bar.vue'
import CustomTitle from '@/components/custom-title/custom-title.vue'
import PreviewPanel from '@/components/preview-panel/preview-panel.vue'
import { showCustomToast } from '@/composables/useCustomToast'
import { usePreviewDetailsStore } from '@/store/previewDetails'
import { useUserStore } from '@/store/user'
import { statusNavTotalHeight } from '@/utils/systemInfo'

const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)

// 素材详情数据（直接使用接口类型）
const assetsDetail = ref<MyAssetsDetail | null>(null)

// 临时预览图（用于切换时先显示缩略图，避免黑屏）
const tempPreviewUrl = ref<string>('')

// 错误状态管理
const errorState = ref<{
  hasError: boolean
  errorCode: number | null
  errorMessage: string
}>({
  hasError: false,
  errorCode: null,
  errorMessage: '',
})

// PreviewDetails Store
const previewDetailsStore = usePreviewDetailsStore()

// 从 URL 参数传入的 title
const urlTitle = ref('')

// 底部TabBar数据
const tabList = ref<any[]>([])
const currentTabIndex = ref(0)
const isLoadingList = ref(false)
const isLoadingPrev = ref(false)
const isLoadingNext = ref(false)

// 从路由参数中获取素材来源
const source = ref<'collectionAssets' | 'assets'>('assets')

// 视频上下文引用
let videoContext: UniApp.VideoContext | null = null

// 详情缓存 Map（key: assetsId, value: MyAssetsDetail）
const detailCache = new Map<number | string, MyAssetsDetail>()

// 预加载数量（前后各3项）
const PRELOAD_COUNT = 3

// 删除/移除弹窗状态
const showRemoveConfirmPopup = ref(false)
const pendingRemoveAssetId = ref<number | string | null>(null)
const isDeleteMode = ref(true)

// 删除/移除确认处理
function handleConfirmRemove() {
  const assetsId = pendingRemoveAssetId.value
  if (!assetsId)
    return

  if (isDeleteMode.value) {
    showRemoveConfirmPopup.value = false
    uni.showLoading({ title: '删除中...' })
    deleteBatchAssets({ assetIds: [assetsId] })
      .then(() => {
        uni.hideLoading()
        showCustomToast({ title: '已删除', icon: 'success' })
        handleAfterDeleteOrRemove(assetsId)
        uni.$emit('assetListNeedRefresh')
        uni.$emit('collectionListNeedRefresh')
        // 通知上个页面刷新数据
        if (source.value === 'collectionAssets') {
          uni.$emit('collectionAssetsUpdated', {
            collectionId: previewDetailsStore.apiParams?.collectionAssets?.collectionId,
          })
        }
      })
      .catch((error: any) => {
        uni.hideLoading()
        console.error('删除素材失败:', error)
        showCustomToast({ title: error.message || '删除失败', icon: 'none' })
      })
  }
  else {
    const collectionId = previewDetailsStore.apiParams?.collectionAssets?.collectionId
    if (!collectionId) {
      showCustomToast({ title: '合集ID不存在', icon: 'none' })
      return
    }
    showRemoveConfirmPopup.value = false
    uni.showLoading({ title: '移除中...' })
    removeAssetsFromCollection({ collectionId, assetIds: [assetsId] })
      .then(() => {
        uni.hideLoading()
        showCustomToast({ title: '已移除', icon: 'success' })
        handleAfterDeleteOrRemove(assetsId)
        uni.$emit('collectionAssetsUpdated', { collectionId })
      })
      .catch((error: any) => {
        uni.hideLoading()
        console.error('移除素材失败:', error)
        showCustomToast({ title: error.message || '移除失败', icon: 'none' })
      })
  }

  pendingRemoveAssetId.value = null
}

// 删除/移除后的逻辑处理
async function handleAfterDeleteOrRemove(assetsId: number | string) {
  const deletedIndex = currentTabIndex.value
  const listLength = tabList.value.length

  if (listLength > 1) {
    tabList.value.splice(deletedIndex, 1)

    let newIndex = deletedIndex
    if (deletedIndex >= tabList.value.length) {
      newIndex = tabList.value.length - 1
    }
    currentTabIndex.value = newIndex

    const newItem = tabList.value[newIndex]
    if (newItem?.id) {
      await Promise.all([loadAssetDetail(newItem.id as number), triggerScrollToCenter()])
    }
  }
  else {
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  }
}

// 置顶/取消置顶
async function handleTopSwitch() {
  if (!assetsDetail.value)
    return

  const assetsId = assetsDetail.value.assetsId
  const isTop = assetsDetail.value.top

  try {
    uni.showLoading({ title: '处理中...' })

    if (isTop) {
      // 取消置顶
      if (source.value === 'collectionAssets') {
        // 合集素材取消置顶
        await cancelTopAsset({
          collectionId: previewDetailsStore.apiParams?.collectionAssets?.collectionId || '',
          assetIds: [assetsId],
        })
      }
      else {
        // 我的素材取消置顶
        await cancelTopMyAsset({ assetIds: [assetsId] })
      }
      showCustomToast({ title: '已取消置顶', icon: 'success' })
    }
    else {
      // 置顶
      if (source.value === 'collectionAssets') {
        // 合集素材置顶
        await topAsset({
          collectionId: previewDetailsStore.apiParams?.collectionAssets?.collectionId || '',
          assetIds: [assetsId],
        })
      }
      else {
        // 我的素材置顶
        await topMyAsset({ assetIds: [assetsId] })
      }
      showCustomToast({ title: '已置顶', icon: 'success' })
    }

    // 立即更新本地状态
    if (assetsDetail.value) {
      assetsDetail.value.top = !isTop
      // 清除缓存，确保下次加载获取最新数据
      detailCache.delete(assetsId)
    }

    // 异步刷新详情数据（确保数据同步）
    loadAssetDetail(assetsId)

    // 通知上个页面刷新数据
    if (source.value === 'collectionAssets') {
      uni.$emit('collectionAssetsUpdated', {
        collectionId: previewDetailsStore.apiParams?.collectionAssets?.collectionId,
      })
    }
    else {
      uni.$emit('assetListNeedRefresh')
    }
  }
  catch (error: any) {
    console.error('置顶操作失败:', error)
    showCustomToast({ title: error.message || '操作失败', icon: 'none' })
  }
  finally {
    uni.hideLoading()
  }
}

// 置底
async function handleBottomSwitch() {
  if (!assetsDetail.value)
    return

  const assetsId = assetsDetail.value.assetsId

  try {
    uni.showLoading({ title: '置底中...' })

    if (source.value === 'assets') {
      await bottomMyAsset({ assetIds: [assetsId] })
    }
    else {
      await bottomAsset({
        collectionId: previewDetailsStore.apiParams?.collectionAssets?.collectionId || '',
        assetIds: [assetsId],
      })
    }

    showCustomToast({ title: '已置底', icon: 'success' })

    // 清除缓存，确保下次加载获取最新数据
    detailCache.delete(assetsId)

    // 刷新详情数据
    loadAssetDetail(assetsId)

    // 通知上个页面刷新数据
    if (source.value === 'assets') {
      uni.$emit('assetListNeedRefresh')
    }
    else {
      uni.$emit('collectionAssetsUpdated', {
        collectionId: previewDetailsStore.apiParams?.collectionAssets?.collectionId,
      })
    }
  }
  catch (error: any) {
    console.error('置底操作失败:', error)
    showCustomToast({ title: error.message || '操作失败', icon: 'none' })
  }
  finally {
    uni.hideLoading()
  }
}

// 删除/移除
function handleRemove() {
  if (!assetsDetail.value)
    return

  const assetsId = assetsDetail.value.assetsId
  const isDelete = source.value === 'assets' || userInfo.value?.level === 4

  pendingRemoveAssetId.value = assetsId
  isDeleteMode.value = isDelete
  showRemoveConfirmPopup.value = true
}

// 分页状态
const paginationState = ref<{
  hasNext: boolean
  hasPrev: boolean
  nextCursor: { id?: number | string, score?: number, isTop?: number, sort?: number } | null
  prevCursor: { id?: number | string, score?: number, isTop?: number, sort?: number } | null
}>({
  hasNext: true,
  hasPrev: false,
  nextCursor: null,
  prevCursor: null,
})

const loadCompleteKey = ref(0)

// BottomTabBar 组件引用
const bottomTabBarRef = ref<InstanceType<typeof BottomTabBar> | null>(null)

/** 切换流程进行中：详情加载 + 底部 Tab 滚动结束，期间禁止新的滑动切换与 Tab 点击 */
const isAssetSwitching = ref(false)

// 触发滚动到中间（与 scroll-view 动画时长对齐，供 await）
async function triggerScrollToCenter() {
  await bottomTabBarRef.value?.scrollToCenter()
}

// 数据加载方向
type Direction = 'NEXT' | 'PREV'

// 最大缓存数据条数（性能优化）
const MAX_CACHE_SIZE = 50
// 触发加载的剩余条数阈值
const LOAD_THRESHOLD = 5

// 滑动手势状态
const swipeState = ref({
  startX: 0,
  startY: 0,
  isSwiping: false,
  moveX: 0,
  lastY: 0,
})

// 滑动阈值（rpx转换为px）
const SWIPE_THRESHOLD = uni.upx2px(150)

// 滑动手势处理
function handleTouchStart(e: TouchEvent) {
  swipeState.value.startX = e.touches[0].clientX
  swipeState.value.startY = e.touches[0].clientY
  swipeState.value.lastY = e.touches[0].clientY
  swipeState.value.isSwiping = true
}

function handleTouchMove(e: TouchEvent) {
  if (!swipeState.value.isSwiping)
    return
  swipeState.value.moveX = e.touches[0].clientX - swipeState.value.startX
  swipeState.value.lastY = e.touches[0].clientY
}

async function handleTouchEnd() {
  uni.hideLoading()
  if (!swipeState.value.isSwiping)
    return

  const deltaX = swipeState.value.moveX
  const deltaY = Math.abs(swipeState.value.startY - swipeState.value.lastY)

  // 必须是水平滑动，且水平距离大于垂直距离；切换锁生效期间不响应新的滑动切换
  if (
    Math.abs(deltaX) > SWIPE_THRESHOLD
    && Math.abs(deltaX) > deltaY
    && !isAssetSwitching.value
  ) {
    // 向左滑 - 切换到下一个
    if (deltaX < 0) {
      if (currentTabIndex.value < tabList.value.length - 1) {
        isAssetSwitching.value = true
        try {
          currentTabIndex.value++
          const item = tabList.value[currentTabIndex.value]
          // 先清除详情数据，避免与临时图重叠
          assetsDetail.value = null
          // 设置临时预览图（缩略图），避免黑屏
          tempPreviewUrl.value = item.thumbUrl || ''
          // 视频显示 loading，图片不显示
          if (item.fileType === 3) {
            uni.showLoading({ title: '加载中...' })
          }
          // 切换时立即预加载前后3项（与加载详情、滚动居中并行）
          preloadAdjacentDetails(currentTabIndex.value)
          // 加载详情与滚动居中并行执行，避免等待API期间滚动位置漂移
          await Promise.all([loadAssetDetail(item.id as number), triggerScrollToCenter()])
        }
        finally {
          isAssetSwitching.value = false
        }
      }
      else if (paginationState.value.hasNext) {
        isAssetSwitching.value = true
        try {
          await loadListByEntrySource('NEXT')
          if (tabList.value.length > currentTabIndex.value + 1) {
            currentTabIndex.value++
            const item = tabList.value[currentTabIndex.value]
            // 先清除详情数据，避免与临时图重叠
            assetsDetail.value = null
            // 设置临时预览图（缩略图），避免黑屏
            tempPreviewUrl.value = item.thumbUrl || ''
            // 视频显示 loading，图片不显示
            if (item.fileType === 3) {
              uni.showLoading({ title: '加载中...' })
            }
            // 切换时立即预加载前后3项（与加载详情、滚动居中并行）
            preloadAdjacentDetails(currentTabIndex.value)
            // 加载详情与滚动居中并行执行，避免等待API期间滚动位置漂移
            await Promise.all([loadAssetDetail(item.id as number), triggerScrollToCenter()])
          }
        }
        finally {
          isAssetSwitching.value = false
        }
      }
      else {
        showCustomToast({ title: '暂时没有更多了', icon: 'none' })
      }
    }
    // 向右滑 - 切换到上一个
    else {
      if (currentTabIndex.value > 0) {
        isAssetSwitching.value = true
        try {
          currentTabIndex.value--
          const item = tabList.value[currentTabIndex.value]
          // 先清除详情数据，避免与临时图重叠
          assetsDetail.value = null
          // 设置临时预览图（缩略图），避免黑屏
          tempPreviewUrl.value = item.thumbUrl || ''
          // 视频显示 loading，图片不显示
          if (item.fileType === 3) {
            uni.showLoading({ title: '加载中...' })
          }
          // 切换时立即预加载前后3项（与加载详情、滚动居中并行）
          preloadAdjacentDetails(currentTabIndex.value)
          // 加载详情与滚动居中并行执行，避免等待API期间滚动位置漂移
          await Promise.all([loadAssetDetail(item.id as number), triggerScrollToCenter()])
        }
        finally {
          isAssetSwitching.value = false
        }
      }
      else if (paginationState.value.hasPrev) {
        isAssetSwitching.value = true
        try {
          await loadListByEntrySource('PREV')
          if (currentTabIndex.value > 0) {
            currentTabIndex.value--
            const item = tabList.value[currentTabIndex.value]
            // 先清除详情数据，避免与临时图重叠
            assetsDetail.value = null
            // 设置临时预览图（缩略图），避免黑屏
            tempPreviewUrl.value = item.thumbUrl || ''
            // 视频显示 loading，图片不显示
            if (item.fileType === 3) {
              uni.showLoading({ title: '加载中...' })
            }
            // 切换时立即预加载前后3项（与加载详情、滚动居中并行）
            preloadAdjacentDetails(currentTabIndex.value)
            // 加载详情与滚动居中并行执行，避免等待API期间滚动位置漂移
            await Promise.all([loadAssetDetail(item.id as number), triggerScrollToCenter()])
          }
        }
        finally {
          isAssetSwitching.value = false
        }
      }
      else {
        showCustomToast({ title: '已经是第一个了', icon: 'none' })
      }
    }
  }

  // 重置状态
  swipeState.value.isSwiping = false
  swipeState.value.moveX = 0
}

// 视频播放状态
const videoState = ref({
  isPlaying: false,
  currentTime: 0,
  duration: 20,
  buffered: 0,
  volume: 1,
  isMuted: false,
})

// 标签顶部位置（确保不超过导航栏高度）
const labelTop = computed(() => {
  const minTop = 15 // rpx
  const navHeight = statusNavTotalHeight * 2 // 转换为 rpx
  return Math.max(minTop, navHeight + 15)
})

// 媒体类型（1-静态图, 2-动态图, 3-视频）
const mediaType = computed(() => {
  if (!assetsDetail.value)
    return 'image'
  return assetsDetail.value.fileType === 3 ? 'video' : 'image'
})

// 置顶标签文本
const topLabel = computed(() => {
  if (!assetsDetail.value)
    return ''
  const type = assetsDetail.value.top
  if (type)
    return '置顶'
  if (!type)
    return ''
  return ''
})

// 页面标题
const pageTitle = computed(() => {
  // 优先使用 URL 传入的 title
  if (urlTitle.value)
    return urlTitle.value

  // 从审核中心跳转过来的，显示审核状态
  if (previewDetailsStore.entrySource === 'auditCenter') {
    const auditStatus = previewDetailsStore.apiParams?.auditCenter?.auditStatus
    const saleStatus = previewDetailsStore.apiParams?.auditCenter?.saleStatus
    // 已下架通过saleStatus判断
    if (saleStatus === 1) {
      return '已下架'
    }
    switch (auditStatus) {
      case 0:
        return '审核中'
      case 1:
        return '已通过'
      case 2:
        return '已拒绝'
      default:
        return '详情'
    }
  }
  return '详情'
})

// 是否显示拒绝/下架原因
const showRejectReason = computed(() => {
  if (previewDetailsStore.entrySource !== 'auditCenter')
    return false
  const auditStatus = previewDetailsStore.apiParams?.auditCenter?.auditStatus
  const saleStatus = previewDetailsStore.apiParams?.auditCenter?.saleStatus
  return auditStatus === 2 || saleStatus === 1
})

// 是否显示底部左侧交互图标栏（审核中心且审核状态为审核中或已拒绝时不显示）
const showLeftInteractionBar = computed(() => {
  if (previewDetailsStore.entrySource !== 'auditCenter')
    return true
  const auditStatus = previewDetailsStore.apiParams?.auditCenter?.auditStatus
  // 审核中(0)或已拒绝(2)时不显示
  return auditStatus !== 0 && auditStatus !== 2
})

// 拒绝/下架原因文本（从详情接口数据中获取）
const rejectReasonText = computed(() => {
  if (!assetsDetail.value)
    return ''
  const auditStatus = previewDetailsStore.apiParams?.auditCenter?.auditStatus
  const saleStatus = previewDetailsStore.apiParams?.auditCenter?.saleStatus
  // 审核拒绝状态显示rejectReason
  if (auditStatus === 2) {
    return assetsDetail.value.rejectReason || ''
  }
  // 已下架状态显示saleDownReason
  if (saleStatus === 1) {
    return assetsDetail.value.saleDownReason || ''
  }
  return ''
})

function handleToggleMute() {
  videoState.value.isMuted = !videoState.value.isMuted
  console.log('切换静音状态:', videoState.value.isMuted ? '静音' : '非静音')
}

// 当前素材ID（用于刷新）
const currentAssetsId = ref<string | number>('')

/**
 * 媒体加载错误处理
 */
// function handleMediaError(error: any) {
//   errorState.value = {
//     hasError: true,
//     errorCode: error?.errMsg || error?.code || 1,
//     errorMessage: error?.errMsg || '加载失败',
//   }
// }

/**
 * 刷新按钮点击处理
 */
function handleRefresh() {
  console.log('刷新素材详情:', currentAssetsId.value)
  if (currentAssetsId.value) {
    detailCache.delete(currentAssetsId.value)
    loadAssetDetail(currentAssetsId.value)
  }
}

// 预览图加载完成
function onPreviewImageLoad() {
  // 高清图加载完成后，清空临时预览图
  tempPreviewUrl.value = ''
}

// 视频开始播放
function onVideoPlay() {
  uni.hideLoading()
}

// 视频元数据加载完成
function onVideoReady() {
  uni.hideLoading()
}

/**
 * 列表接口响应数据（增强版，包含前后翻页字段）
 */
interface ListResponse {
  records: any[]
  hasNext: boolean
  hasPrev: boolean
  nextCursorId: number | string | null
  nextCursorScore: number | null
  nextCursorIsTop?: number | null
  nextCursorSort?: number | null
  prevCursorId: number | string | null
  prevCursorScore: number | null
  prevCursorIsTop?: number | null
  prevCursorSort?: number | null
}

/**
 * 核心方法：获取列表数据（封装所有entrySource的API调用）
 * @param direction 加载方向
 * @param cursor 游标参数（用于分页加载），不传则使用初始ID加载
 */
async function fetchListData(
  direction: Direction,
  cursor?: { id?: number | string, score?: number, isTop?: number, sort?: number },
): Promise<ListResponse | null> {
  const entrySource = previewDetailsStore.entrySource
  const apiParams = previewDetailsStore.apiParams
  console.log('来源：', entrySource)
  if (!entrySource)
    return null

  const pageSize = 10

  switch (entrySource) {
    case 'creativeSpaceIndex': {
      const params = apiParams?.creativeSpaceIndex
      if (!params)
        break

      const data = await getMyAssetList({
        pageSize,
        direction,
        ...(params.category ? { category: params.category } : {}),
        ...(params.fileType ? { fileType: params.fileType } : {}),
        ...(cursor?.id
          ? {
              cursorId: cursor.id,
              sortOrder: cursor.score,
              cursorIsTop: cursor.isTop,
            }
          : {}),
      })
      return {
        records: data.records || [],
        hasNext: data.hasNext || false,
        hasPrev: (data as any).hasPrev || false,
        nextCursorId: data.nextCursorId,
        nextCursorScore: data.nextCursorScore || null,
        nextCursorIsTop: (data as any).nextCursorIsTop ?? null,
        nextCursorSort: (data as any).nextCursorSort ?? null,
        prevCursorId: (data as any).prevCursorId || null,
        prevCursorScore: data.prevCursorScore || null,
        prevCursorIsTop: (data as any).prevCursorIsTop ?? null,
        prevCursorSort: (data as any).prevCursorSort ?? null,
      }
    }

    case 'collectionAssets': {
      const params = apiParams?.collectionAssets
      if (!params?.collectionId)
        break
      const data = await getCollectionAssets({
        collectionId: params.collectionId,
        pageSize,
        direction,
        ...(cursor?.id
          ? {
              cursorId: String(cursor.id),
              cursorIsTop: cursor.isTop,
              cursorSort: cursor.sort,
            }
          : {}),
      })
      return {
        records: data.records.map((item: any) => ({
          id: item.id,
          thumbUrl: item.thumbUrl,
          categoryName: item.categoryName,
          isTop: item.isTop,
          likeCountFormatted: item.likeCountFormatted,
          downloadCountFormatted: item.downloadCountFormatted,
        })),
        hasNext: data.hasNext,
        hasPrev: data.hasPrev,
        nextCursorId: data.nextCursorId,
        nextCursorScore: data.nextCursorScore,
        nextCursorIsTop: data.nextCursorIsTop,
        nextCursorSort: data.nextCursorSort,
        prevCursorId: data.prevCursorId,
        prevCursorScore: data.prevCursorScore,
        prevCursorIsTop: data.prevCursorIsTop,
        prevCursorSort: data.prevCursorSort,
      }
    }

    case 'auditCenter': {
      const params = apiParams?.auditCenter
      if (!params?.id)
        break
      const data = await getAuditList({
        pageSize,
        direction,
        ...(params.auditStatus !== undefined ? { auditStatus: params.auditStatus } : {}),
        ...(params.saleStatus !== undefined ? { saleStatus: params.saleStatus } : {}),
        ...(cursor?.id
          ? {
              cursorId: cursor.id,
              cursorSort: cursor.score,
            }
          : {}),
      })
      return {
        records: data.records || [],
        hasNext: data.hasNext || false,
        hasPrev: (data as any).hasPrev || false,
        nextCursorId: data.nextCursorId,
        nextCursorScore: data.nextCursorScore || null,
        nextCursorIsTop: (data as any).nextCursorIsTop ?? null,
        nextCursorSort: (data as any).nextCursorSort ?? null,
        prevCursorId: (data as any).prevCursorId || null,
        prevCursorScore: data.prevCursorScore || null,
        prevCursorIsTop: (data as any).prevCursorIsTop ?? null,
        prevCursorSort: (data as any).prevCursorSort ?? null,
      }
    }

    default:
      console.warn('未知的入口来源:', entrySource)
  }

  return null
}

/**
 * 统一的列表数据加载方法（支持普通加载和初始加载）
 * @param direction 加载方向：'NEXT'-往后查，'PREV'-往前查
 * @param isInitial 是否是初始加载（同时加载前后数据）
 * @param initialId 初始加载时的当前项ID
 */
async function loadListByEntrySource(direction: Direction = 'NEXT', isInitial = false, initialId?: number) {
  const entrySource = previewDetailsStore.entrySource

  // 初始加载：同时加载前后数据
  if (isInitial && initialId) {
    await loadInitialData(initialId, entrySource)
    return
  }

  // 检查是否正在加载或没有更多数据
  if (direction === 'NEXT' && (isLoadingNext.value || !paginationState.value.hasNext))
    return
  if (direction === 'PREV' && (isLoadingPrev.value || !paginationState.value.hasPrev))
    return

  // 设置加载状态
  if (direction === 'NEXT') {
    isLoadingNext.value = true
  }
  else {
    isLoadingPrev.value = true
  }
  isLoadingList.value = true

  try {
    // 使用当前游标获取数据
    const cursor = direction === 'NEXT'
      ? paginationState.value.nextCursor
      : paginationState.value.prevCursor

    const response = await fetchListData(direction, cursor || undefined)
    if (!response)
      return

    // 更新列表数据（根据方向插入到头部或尾部）
    if (direction === 'PREV') {
      // 先补偿 scroll-left，再 unshift 数据
      // 两者在同一同步块，Vue 合并到一帧渲染，保持用户当前浏览位置不变
      bottomTabBarRef.value?.adjustForPrepend(response.records.length)
      tabList.value.unshift(...response.records)
      currentTabIndex.value += response.records.length
      paginationState.value.hasPrev = response.hasPrev
    }
    else {
      tabList.value.push(...response.records)
      paginationState.value.hasNext = response.hasNext
    }

    // 性能优化：数据量过大时，移除相反方向的多余数据
    optimizeDataCache(direction)

    // 根据方向更新对应的游标
    if (direction === 'NEXT') {
      // 向后加载时，更新 nextCursor
      paginationState.value.nextCursor = response.nextCursorId
        ? { id: response.nextCursorId, score: response.nextCursorScore, isTop: response.nextCursorIsTop, sort: response.nextCursorSort }
        : null
    }
    else {
      // 向前加载时，更新 prevCursor
      paginationState.value.prevCursor = response.prevCursorId
        ? { id: response.prevCursorId, score: response.prevCursorScore, isTop: response.prevCursorIsTop, sort: response.prevCursorSort }
        : null
    }

    console.log('加载列表数据成功:', {
      entrySource,
      direction,
      newRecordsCount: response.records.length,
      totalCount: tabList.value.length,
      hasNext: response.hasNext,
      hasPrev: response.hasPrev,
    })
  }
  catch (error) {
    console.error('加载列表数据失败:', error)
  }
  finally {
    isLoadingList.value = false
    if (direction === 'NEXT') {
      isLoadingNext.value = false
    }
    else {
      isLoadingPrev.value = false
    }
    loadCompleteKey.value++
  }
}

/**
 * 初始加载数据 - 同时加载当前项的前10条和后10条数据
 */
async function loadInitialData(currentAssetsId: number, entrySource: string) {
  isLoadingList.value = true

  try {
    const currentItem = previewDetailsStore.currentItem
    const currentItemId = currentItem?.relationId || currentItem?.id || currentAssetsId
    const currentItemSort = currentItem?.sort || 0
    const currentItemIsTop = currentItem?.isTop || 0
    const currentItemHotScore = entrySource === 'creativeSpaceIndex' ? currentItem?.sort : currentItem?.hotScore
    // 调用两次列表接口：prev 和 next
    const [prevResponse, nextResponse] = await Promise.all([
      fetchListData('PREV', { id: currentItemId, sort: currentItemSort, isTop: currentItemIsTop, score: currentItemHotScore }),
      fetchListData('NEXT', { id: currentItemId, sort: currentItemSort, isTop: currentItemIsTop, score: currentItemHotScore }),
    ])

    // 拼接数据：prev数据 + currentItem + next数据
    const prevRecords = prevResponse?.records || []
    const nextRecords = nextResponse?.records || []
    const fullList: any[] = [...prevRecords]

    if (currentItem) {
      fullList.push(currentItem)
    }
    fullList.push(...nextRecords)

    // 更新列表数据
    tabList.value = fullList
    currentTabIndex.value = prevRecords.length

    // 更新分页状态
    paginationState.value.hasPrev = prevResponse?.hasPrev
    paginationState.value.hasNext = nextResponse?.hasNext
    console.log(paginationState.value)
    paginationState.value.prevCursor = prevResponse?.prevCursorId
      ? { id: prevResponse.prevCursorId, score: prevResponse.prevCursorScore, isTop: prevResponse.prevCursorIsTop, sort: prevResponse.prevCursorSort }
      : null
    paginationState.value.nextCursor = nextResponse?.nextCursorId
      ? { id: nextResponse.nextCursorId, score: nextResponse.nextCursorScore, isTop: nextResponse.nextCursorIsTop, sort: nextResponse.nextCursorSort }
      : null

    console.log('初始加载列表数据成功:', {
      prevCount: prevRecords.length,
      nextCount: nextRecords.length,
      totalCount: fullList.length,
      currentIndex: currentTabIndex.value,
    })
  }
  catch (error) {
    console.error('初始加载列表数据失败:', error)
  }
  finally {
    isLoadingList.value = false
  }
}

/**
 * 性能优化：限制缓存数据量，移除多余数据
 * 当数据量超过MAX_CACHE_SIZE时，移除相反方向的多余数据
 */
function optimizeDataCache(direction: Direction) {
  const totalCount = tabList.value.length

  if (totalCount <= MAX_CACHE_SIZE)
    return

  // 计算需要移除的数据量
  const excessCount = totalCount - MAX_CACHE_SIZE

  if (direction === 'NEXT') {
    // 如果正在往后加载，移除前面的数据（保留头部部分数据作为缓冲）
    const keepFrontCount = Math.min(10, Math.floor(MAX_CACHE_SIZE / 2))
    const removeCount = Math.max(0, currentTabIndex.value - keepFrontCount)

    if (removeCount > 0) {
      tabList.value.splice(0, removeCount)
      currentTabIndex.value -= removeCount
      // 标记前面还有数据可以加载
      paginationState.value.hasPrev = true
      console.log('性能优化：移除前面数据', { removeCount, keepFrontCount })
    }
  }
  else {
    // 如果正在往前加载，移除后面的数据（保留尾部部分数据作为缓冲）
    const keepBackCount = Math.min(10, Math.floor(MAX_CACHE_SIZE / 2))
    const removeCount = Math.max(0, tabList.value.length - currentTabIndex.value - 1 - keepBackCount)

    if (removeCount > 0) {
      tabList.value.splice(tabList.value.length - removeCount, removeCount)
      // 标记后面还有数据可以加载
      paginationState.value.hasNext = true
      console.log('性能优化：移除后面数据', { removeCount, keepBackCount })
    }
  }
}

/**
 * 处理Tab切换
 */
async function handleTabChange(index: number) {
  uni.hideLoading()
  if (index < 0 || index >= tabList.value.length)
    return

  // 如果点击的是已激活的Tab，不执行后续代码
  if (index === currentTabIndex.value) {
    console.log('[Tab切换] 点击的是已激活的Tab，不执行操作')
    return
  }

  if (isAssetSwitching.value)
    return

  isAssetSwitching.value = true
  try {
    currentTabIndex.value = index
    const item = tabList.value[index]

    // 先清除详情数据，避免与临时图重叠
    assetsDetail.value = null

    // 设置临时预览图（缩略图），避免黑屏
    tempPreviewUrl.value = item.thumbUrl || ''
    // 视频显示 loading，图片不显示
    if (item.fileType === 3) {
      uni.showLoading({ title: '加载中...' })
    }

    // 切换时立即预加载前后3项（与加载详情、滚动居中并行）
    preloadAdjacentDetails(index)

    // 加载详情与滚动居中并行执行，避免等待API期间滚动位置漂移
    await Promise.all([loadAssetDetail(item.id as number), triggerScrollToCenter()])
  }
  finally {
    isAssetSwitching.value = false
  }
}

/**
 * 处理加载更多数据（由BottomTabBar组件触发）
 * @param direction 加载方向：'PREV'-往前查，'NEXT'-往后查
 */
function handleLoadMore(direction: 'PREV' | 'NEXT') {
  loadListByEntrySource(direction)
}

/**
 * 预加载前后相邻素材的详情数据
 */
function preloadAdjacentDetails(currentIndex: number) {
  const preloadIndices: number[] = []
  for (let i = 1; i <= PRELOAD_COUNT; i++) {
    const prevIndex = currentIndex - i
    const nextIndex = currentIndex + i
    if (prevIndex >= 0) {
      preloadIndices.push(prevIndex)
    }
    if (nextIndex < tabList.value.length) {
      preloadIndices.push(nextIndex)
    }
  }

  preloadIndices.forEach((index) => {
    const item = tabList.value[index]
    if (item?.id) {
      const assetsId = item.id
      if (!detailCache.has(assetsId)) {
        getMyAssetsDetail({ assetsId, collectionId: previewDetailsStore.apiParams?.collectionAssets?.collectionId || '' })
          .then((detail) => {
            detailCache.set(assetsId, detail)
          })
          .catch((error) => {
            console.warn('[预加载] 获取相邻素材详情失败:', error)
          })
      }
    }
  })
}

/**
 * 加载素材详情
 */
async function loadAssetDetail(assetsId: number | string) {
  // 先检查缓存中是否有该素材的详情
  const cachedDetail = detailCache.get(assetsId)
  if (cachedDetail) {
    assetsDetail.value = cachedDetail
    // 不主动清空 tempPreviewUrl，等 onPreviewImageLoad(@load) 事件触发后再清空
    // 加载成功，重置错误状态
    errorState.value = {
      hasError: false,
      errorCode: null,
      errorMessage: '',
    }
    return
  }

  try {
    const detail = await getMyAssetsDetail({ assetsId, collectionId: previewDetailsStore.apiParams?.collectionAssets?.collectionId || '' })
    assetsDetail.value = detail
    // 存入缓存
    detailCache.set(assetsId, detail)
    // 加载成功，重置错误状态
    errorState.value = {
      hasError: false,
      errorCode: null,
      errorMessage: '',
    }
  }
  catch (error: any) {
    console.error('获取素材详情失败:', error)
    // 加载失败，设置错误状态
    errorState.value = {
      hasError: true,
      errorCode: error?.code,
      errorMessage: error?.message || '加载失败',
    }
  }
}

// 页面加载时获取素材详情和列表数据
onLoad(async (options) => {
  if (options?.id) {
    const assetsId = options.id
    // 保存当前素材ID用于刷新
    currentAssetsId.value = assetsId
    // 从路由参数中获取素材来源
    source.value = options.source || 'assets'
    // 保存 URL 传入的 title
    if (options.title) {
      urlTitle.value = decodeURIComponent(options.title as string)
    }

    // 加载当前素材详情
    await loadAssetDetail(assetsId)
    // 加载底部TabBar列表数据（从首页进来的不加载，通过分享链接进来的也不加载）
    if (previewDetailsStore.entrySource) {
      // 使用新的初始加载方法，同时加载前10条和后10条数据
      await loadListByEntrySource('NEXT', true, assetsId)
      // 匹配并激活对应的Tab项
      activateTabById(assetsId)
      // 初始化时预加载前后3项
      const currentIndex = tabList.value.findIndex(item => item.id === assetsId)
      if (currentIndex !== -1) {
        preloadAdjacentDetails(currentIndex)
      }
    }
  }
})

/**
 * 根据ID激活对应的Tab项并滚动到可视范围
 */
function activateTabById(assetsId: number) {
  // 在tabList中查找匹配的项
  const index = tabList.value.findIndex(item => item.id === assetsId)
  if (index !== -1) {
    // 找到匹配的项，激活它
    currentTabIndex.value = index
    console.log('激活Tab项:', { assetsId, index })
    // TODO: 滚动到可视范围（需要BottomTabBar组件支持）
  }
  else {
    console.warn('未找到匹配的Tab项:', assetsId)
  }
}

// 页面卸载时清除store数据
onUnload(() => {
  console.log('页面卸载，清除store数据')
  previewDetailsStore.clearAll()
  // 清除详情缓存
  detailCache.clear()
  console.log('[页面卸载] 清除详情缓存')
})

// 获取视频上下文
function getVideoContext() {
  if (mediaType.value === 'video' && assetsDetail.value?.previewUrl) {
    videoContext = uni.createVideoContext(`video-${assetsDetail.value.previewUrl}`, {})
  }
  return videoContext
}

// 页面隐藏时停止视频
onHide(() => {
  const ctx = getVideoContext()
  if (ctx) {
    ctx.pause()
    videoState.value.isPlaying = false
  }
})

// 页面显示时重新播放视频
onShow(() => {
  if (mediaType.value === 'video') {
    const ctx = getVideoContext()
    if (ctx) {
      ctx.play()
      videoState.value.isPlaying = true
    }
  }
})
</script>

<template>
  <view class="relative h-screen w-full overflow-hidden bg-black">
    <!-- IP名称标题 -->
    <custom-title :text="pageTitle" text-color="text-white" />
    <!-- 预览面板 -->
    <PreviewPanel
      :media-url="assetsDetail?.previewUrl || ''"
      :temp-url="tempPreviewUrl"
      :media-type="mediaType"
      :label="topLabel"
      :label-top="labelTop"
      type="preview"
      :show-watermark="false"
      :has-error="errorState.hasError"
      :error-code="errorState.errorCode"
      :error-msg="errorState.errorMessage"
      :switch-locked="isAssetSwitching"
      @toggle-mute="handleToggleMute"
      @image-load="onPreviewImageLoad"
      @video-play="onVideoPlay"
      @video-ready="onVideoReady"
      @touch-start="handleTouchStart"
      @touch-move="handleTouchMove"
      @touch-end="handleTouchEnd"
      @refresh="handleRefresh"
    />
    <!-- 右侧交互面板 -->
    <RightInteractionPanelMy
      v-if="!errorState.hasError && assetsDetail && previewDetailsStore.entrySource !== 'auditCenter'"
      :top="assetsDetail?.top"
      :source="source"
      @top-switch="handleTopSwitch"
      @bottom-switch="handleBottomSwitch"
      @remove="handleRemove"
    />

    <!-- 底部左侧交互图标栏 -->
    <view
      v-if="assetsDetail && showLeftInteractionBar"
      class="absolute left-30rpx z-10 flex items-center"
      :style="{ bottom: `calc(env(safe-area-inset-bottom) + 88rpx + 30rpx + 104rpx)` }"
    >
      <!-- 点赞 -->
      <view class="mr-10rpx flex items-center">
        <image class="h-40rpx w-40rpx" src="/static/images/ic_heaet_off.png" mode="aspectFit" />
        <text class="ml-4rpx text-24rpx text-white font-bold" style="text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.30);">{{ assetsDetail?.likeCountFormatted }}</text>
      </view>
      <!-- 收藏 -->
      <view class="mr-10rpx flex items-center">
        <image class="h-40rpx w-40rpx" src="/static/images/ic_star_off.png" mode="aspectFit" />
        <text class="ml-4rpx text-24rpx text-white font-bold" style="text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.30);">{{ assetsDetail?.favoriteCountFormatted }}</text>
      </view>
      <!-- 分享 -->
      <view class="mr-10rpx flex items-center">
        <image class="h-40rpx w-40rpx" src="/static/images/ic_share.png" mode="aspectFit" />
        <text class="ml-4rpx text-24rpx text-white font-bold" style="text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.30);">{{ assetsDetail?.shareCountFormatted }}</text>
      </view>
      <!-- 下载 -->
      <view class="flex items-center">
        <image class="h-40rpx w-40rpx" src="/static/images/ic_download.png" mode="aspectFit" />
        <text class="ml-4rpx text-24rpx text-white font-bold" style="text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.30);">{{ assetsDetail?.downloadCountFormatted }}</text>
      </view>
    </view>

    <!-- 拒绝/下架原因提示 -->
    <view
      v-if="showRejectReason"
      class="absolute left-30rpx right-30rpx z-10 rounded-16rpx bg-[rgba(0,0,0,0.8)] pa-24rpx"
      :style="{ bottom: `calc(env(safe-area-inset-bottom) + 88rpx + 150rpx + 104rpx)` }"
    >
      <text class="text-28rpx text-white leading-44rpx">
        {{ rejectReasonText }}
      </text>
    </view>

    <!-- 底部 TabBar - 从首页进来的不显示 -->
    <BottomTabBar
      ref="bottomTabBarRef"
      :tabs="tabList"
      :current-index="currentTabIndex"
      :has-prev="paginationState.hasPrev"
      :has-next="paginationState.hasNext"
      :load-complete-key="loadCompleteKey"
      :switch-locked="isAssetSwitching"
      @change="handleTabChange"
      @load-more="handleLoadMore"
    />

    <!-- 删除/移除确认弹窗 -->
    <ConfirmPopup
      v-model:visible="showRemoveConfirmPopup"
      :title="isDeleteMode ? '删除素材' : '移除素材'"
      :message="`确定要${isDeleteMode ? '删除' : '移除'}此素材吗？`"
      :confirm-text="isDeleteMode ? '确认删除' : '确认移除'"
      @confirm="handleConfirmRemove"
    />
  </view>
</template>

<style scoped lang="scss">
/* 页面容器基础样式 */
</style>
