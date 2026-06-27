<script lang="ts" setup>
import type { CollectionAssetItem } from '@/api/ip/ip'
import type { MyAssetItem } from '@/api/me/me'
import { onLoad, onPageScroll, onShow, onUnload } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { computed, nextTick, reactive, ref, shallowRef, watch, watchEffect } from 'vue'
import { bottomAsset, bottomMyAsset, cancelTopAsset, cancelTopMyAsset, deleteBatchAssets, removeAssetsFromCollection, sortAssets, sortCollectionAssets, topAsset, topMyAsset } from '@/api/creativeSpace/creativeSpace'
import { getCollectionAssets } from '@/api/ip/ip'
import { getMyAssetList } from '@/api/me/me'
import { showCustomToast } from '@/composables/useCustomToast'
import { usePageScrollBridge } from '@/hooks/usePageScrollBridge'
import { usePageScrollStore } from '@/store/pageScroll'
import { useUserStore } from '@/store/user'
import { statusNavTotalHeight, systemInfo } from '@/utils/systemInfo'

const userStore = useUserStore()
const pageScrollStore = usePageScrollStore()
const { backToTopTrigger } = storeToRefs(pageScrollStore)
usePageScrollBridge()
const userInfo = computed(() => userStore.userInfo)

/** 页脚估算：pt-20rpx + 操作栏 60rpx + pb-40rpx（与 #emp-footer 样式一致） 再加10px（跟滚动区域的间距） */
const FOOTER_HEIGHT_FALLBACK_PX = uni.upx2px(20 + 60 + 40 + 10)
const footerHeightPx = ref(FOOTER_HEIGHT_FALLBACK_PX)

/** scroll-view 可视高度 = 100vh - 底部固定 footer */
const scrollViewStyle = computed(() => ({
  height: `calc(100vh - ${footerHeightPx.value}px)`,
}))

function measureFooterHeight() {
  nextTick(() => {
    uni.createSelectorQuery()
      .select('#emp-footer')
      .boundingClientRect((rect) => {
        const box = Array.isArray(rect) ? rect[0] : rect
        if (box?.height && box.height > 0)
          footerHeightPx.value = box.height
      })
      .exec()
  })
}

const scrollTopValue = ref(0)
const customToTopBottom = ref('192rpx')

watchEffect(() => {
  if (backToTopTrigger.value > 0) {
    scrollTopValue.value = 1
    setTimeout(() => {
      scrollTopValue.value = 0
    }, 50)
  }
})
// 页面参数
const collectionId = ref<string>()
const collectionName = ref('合集名称')

// editor-assets-panel 组件 ref
const editorPanelRef = shallowRef<any>(null)

// 页面类型：collection-编辑合集素材，asset-编辑全部素材
const pageType = ref<'collection' | 'asset'>('collection')

// 页面标题：名称与数量分开，由 custom-title 分栏展示
const pageTitleText = ref('编辑合集素材')
const pageTitleCount = ref<number | string>(0)

onLoad((options) => {
  collectionId.value = options?.id || undefined
  collectionName.value = options?.name || '合集名称'
  // 判断页面类型
  pageType.value = !collectionId.value ? 'asset' : 'collection'
  pageTitleText.value = pageType.value === 'asset' ? '编辑管理' : collectionName.value
  // 设置页面标题
  // uni.setNavigationBarTitle({
  //   title: pageType.value === 'asset' ? '编辑素材' : '编辑合集素材',
  // })
  // 初始加载数据
  fetchAssetList(true)
  // 更新页面标题文本（初始为空，等接口返回后更新）
  updatePageTitle(0)
})

definePage({
  style: {
    navigationBarTitleText: '编辑合集素材',
  },
})

const showRemoveConfirmPopup = ref(false)
const pendingRemoveIds = ref<Array<string | number>>([])
const isDeleteMode = ref(true)

function handleConfirmRemove() {
  const ids = pendingRemoveIds.value
  if (ids.length === 0)
    return

  if (isDeleteMode.value) {
    showRemoveConfirmPopup.value = false
    uni.showLoading({ title: '删除中...' })
    deleteBatchAssets({ assetIds: ids })
      .then(() => {
        uni.hideLoading()
        showCustomToast({ title: '删除成功', icon: 'success' })
        fetchAssetList(true)
        editorPanelRef.value?.clearSelection()
        uni.$emit('assetListNeedRefresh')
        uni.$emit('collectionListNeedRefresh')
      })
      .catch((error) => {
        uni.hideLoading()
        console.error('删除素材失败', error)
        showCustomToast({ title: '删除失败', icon: 'none' })
      })
  }
  else {
    if (!collectionId.value) {
      showCustomToast({ title: '合集ID不存在', icon: 'none' })
      return
    }
    showRemoveConfirmPopup.value = false
    uni.showLoading({ title: '移除中...' })
    removeAssetsFromCollection({ collectionId: collectionId.value, assetIds: ids })
      .then(() => {
        uni.hideLoading()
        showCustomToast({ title: '移除成功', icon: 'success' })
        fetchAssetList(true)
        editorPanelRef.value?.clearSelection()
        uni.$emit('collectionAssetsUpdated', { collectionId: collectionId.value })
      })
      .catch((error) => {
        uni.hideLoading()
        console.error('移除素材失败', error)
        showCustomToast({ title: '移除失败', icon: 'none' })
      })
  }

  pendingRemoveIds.value = []
}

function handleCancelRemove() {
  pendingRemoveIds.value = []
}

// 素材列表数据
const assetList = ref<(CollectionAssetItem | MyAssetItem)[]>([])

// 数据总数
const totalCount = ref<number | string>('0')

// 当前选中的分类 ID（用于 Tab 切换时记录当前分类，后续可能用于接口过滤）
const currentCategoryId = ref<string>('')

// 分页状态（游标分页）
const pageState = reactive({
  nextCursorId: undefined as number | string | undefined,
  nextCursorIsTop: undefined as number | undefined,
  nextCursorSort: undefined as number | undefined,
  nextCursorScore: undefined as number | undefined,
  hasNext: true,
  loading: false,
})

onShow(() => {
  pageScrollStore.setToTopBottom(customToTopBottom.value)
  measureFooterHeight()
  setTimeout(() => {
    if (uni.getStorageSync('needRefreshFromException') === '1') {
      uni.removeStorageSync('needRefreshFromException')
      fetchAssetList(true)
    }
  }, 100)
})

watch(() => assetList.value.length, (len) => {
  if (len > 0)
    measureFooterHeight()
})

function isPinnedAsset(item: CollectionAssetItem | MyAssetItem) {
  return Number(item.isTop) === 1
}

/** 置顶项在前，保持与接口列表一致的分区顺序 */
function reorderAssetsByPin(items: (CollectionAssetItem | MyAssetItem)[]) {
  return [...items.filter(isPinnedAsset), ...items.filter(i => !isPinnedAsset(i))]
}

function applyPinOptimistic(assetIds: Array<string | number>) {
  const idSet = new Set(assetIds.map(String))
  assetList.value = reorderAssetsByPin(
    assetList.value.map(item => idSet.has(String(item.id)) ? { ...item, isTop: 1 } : item),
  )
}

function applyUnpinOptimistic(assetIds: Array<string | number>) {
  const idSet = new Set(assetIds.map(String))
  assetList.value = reorderAssetsByPin(
    assetList.value.map(item => idSet.has(String(item.id)) ? { ...item, isTop: 0 } : item),
  )
}

function applyBottomOptimistic(assetIds: Array<string | number>) {
  const idSet = new Set(assetIds.map(String))
  const picked: (CollectionAssetItem | MyAssetItem)[] = []
  const others: (CollectionAssetItem | MyAssetItem)[] = []
  for (const item of assetList.value) {
    if (idSet.has(String(item.id)))
      picked.push(item)
    else
      others.push(item)
  }
  assetList.value = [...others, ...picked]
}

// 获取素材列表
async function fetchAssetList(isRefresh = false, silent = false) {
  if (pageState.loading || (!pageState.hasNext && !isRefresh))
    return
  pageState.loading = true

  if (isRefresh) {
    pageState.nextCursorId = undefined
    pageState.nextCursorIsTop = undefined
    pageState.nextCursorSort = undefined
    pageState.nextCursorScore = undefined
    pageState.hasNext = true
  }

  const pageSize = isRefresh ? Math.max(20, assetList.value.length || 20) : 20

  try {
    if (pageType.value === 'asset') {
      const res = await getMyAssetList({
        pageSize,
        cursorId: pageState.nextCursorId as number | undefined,
        cursorIsTop: pageState.nextCursorIsTop,
        sortOrder: pageState.nextCursorScore,
      })

      if (isRefresh) {
        assetList.value = res.records
        totalCount.value = res.total || res.assetCountFormatted || 0
        updatePageTitle(totalCount.value)
      }
      else {
        assetList.value = [...assetList.value, ...res.records]
      }

      pageState.nextCursorId = res.nextCursorId ?? undefined
      pageState.nextCursorIsTop = res.nextCursorIsTop ?? undefined
      pageState.nextCursorScore = res.nextCursorScore ?? undefined
      pageState.hasNext = res.hasNext
    }
    else {
      const res = await getCollectionAssets({
        collectionId: collectionId.value!,
        cursorId: pageState.nextCursorId,
        cursorIsTop: pageState.nextCursorIsTop,
        cursorSort: pageState.nextCursorSort,
        pageSize,
      })

      if (isRefresh) {
        assetList.value = res.records
        totalCount.value = res.total || res.assetCountFormatted || 0
        updatePageTitle(totalCount.value)
      }
      else {
        assetList.value = [...assetList.value, ...res.records]
      }

      pageState.nextCursorId = res.nextCursorId ?? undefined
      pageState.nextCursorIsTop = res.nextCursorIsTop ?? undefined
      pageState.nextCursorSort = res.nextCursorSort ?? undefined
      pageState.hasNext = res.hasNext
    }
  }
  catch (error) {
    console.error('获取素材列表失败', error)
  }
  finally {
    pageState.loading = false
    // 数据加载完成后检查是否可以滚动（初始加载和加载更多都需要检查）
    await nextTick()
    checkCanScroll()
  }
}

// 更新页面标题数量
function updatePageTitle(total: number | string) {
  pageTitleCount.value = total
}

// 是否已经检查过是否可以滚动
let hasCheckedCanScroll = false

// 判断页面内容是否超出一页
function checkCanScroll() {
  // 避免重复检查
  if (hasCheckedCanScroll)
    return
  hasCheckedCanScroll = true

  // 延迟执行，确保页面已渲染
  setTimeout(() => {
    // 获取页面内容高度 - 选择页面内容区域 .page-content
    const query = uni.createSelectorQuery()
    query.select('.page-content').boundingClientRect((res: any) => {
      if (res && res.height > 0) {
        const scrollHeight = res.height
        const canScroll = scrollHeight > (systemInfo.windowHeight || 0)
        pageScrollStore.setCanScroll(canScroll)
      }
    }).exec()
  }, 500)
}

// 处理 Tab 切换
const handleTabChange = (tabId: string) => {
  currentCategoryId.value = tabId
  // 切换分类时刷新列表
  fetchAssetList(true)
}

// 处理素材操作
const handleChanged = async (event: {
  action: string
  selectedIds: Array<string | number>
  changed: boolean
  sortedList?: Array<{ id: string | number }>
  sortList?: Array<{ id: string | number }>
  draggedId?: string | number
  previewIndex?: number
}) => {
  // 排序
  if (event.action === 'sort') {
    if (!event.sortedList || event.sortedList.length === 0 || !event.draggedId) {
      return
    }

    const sortedList = event.sortedList
    // sortList 为当前拖拽分区（置顶/普通）内的顺序；previewIndex 也是该分区内的下标
    const neighborList = event.sortList?.length ? event.sortList : sortedList
    const previewIndex = event.previewIndex ?? neighborList.findIndex(item => item.id === event.draggedId)

    const prevAssetId = previewIndex > 0 ? neighborList[previewIndex - 1]?.id : null
    const nextAssetId = previewIndex >= 0 && previewIndex < neighborList.length - 1 ? neighborList[previewIndex + 1]?.id : null

    try {
      if (pageType.value === 'asset') {
        await sortAssets({
          assetId: event.draggedId,
          prevAssetId,
          nextAssetId,
        })
        uni.$emit('assetListNeedRefresh')
      }
      else {
        await sortCollectionAssets({
          collectionId: collectionId.value,
          assetId: event.draggedId,
          prevAssetId,
          nextAssetId,
        })
        uni.$emit('collectionAssetsUpdated', { collectionId: collectionId.value })
      }
      if (event.sortedList?.length) {
        const order = new Map(event.sortedList.map((x, i) => [String(x.id), i]))
        assetList.value = reorderAssetsByPin(
          [...assetList.value].sort((a, b) => (order.get(String(a.id)) ?? 0) - (order.get(String(b.id)) ?? 0)),
        )
      }
    }
    catch (error) {
      console.error('排序失败', error)
    }
    return
  }
  // 移除/删除素材
  if (event.action === 'remove') {
    const isDelete = pageType.value === 'asset' || userInfo.value?.level === 4

    pendingRemoveIds.value = event.selectedIds
    isDeleteMode.value = isDelete

    if (!isDelete && !collectionId.value) {
      showCustomToast({ title: '合集ID不存在', icon: 'none' })
      return
    }

    showRemoveConfirmPopup.value = true
    return
  }
  // 置顶
  if (event.action === 'pin') {
    try {
      if (pageType.value === 'asset') {
        await topMyAsset({ assetIds: event.selectedIds })
        showCustomToast({ title: '置顶成功', icon: 'success' })
        applyPinOptimistic(event.selectedIds)
        editorPanelRef.value?.clearSelection()
        fetchAssetList(true, true)
        uni.$emit('assetListNeedRefresh')
      }
      else {
        await topAsset({
          collectionId: collectionId.value,
          assetIds: event.selectedIds,
        })
        showCustomToast({ title: '置顶成功', icon: 'success' })
        applyPinOptimistic(event.selectedIds)
        editorPanelRef.value?.clearSelection()
        fetchAssetList(true, true)
        uni.$emit('collectionAssetsUpdated', { collectionId: collectionId.value })
      }
    }
    catch (error) {
      console.error('置顶素材失败', error)
      showCustomToast({ title: '置顶失败', icon: 'none' })
    }
    return
  }
  // 取消置顶
  if (event.action === 'unpin') {
    try {
      if (pageType.value === 'asset') {
        await cancelTopMyAsset({ assetIds: event.selectedIds })
        showCustomToast({ title: '取消置顶成功', icon: 'success' })
        applyUnpinOptimistic(event.selectedIds)
        editorPanelRef.value?.clearSelection()
        fetchAssetList(true, true)
        uni.$emit('assetListNeedRefresh')
      }
      else {
        await cancelTopAsset({
          collectionId: collectionId.value,
          assetIds: event.selectedIds,
        })
        showCustomToast({ title: '取消置顶成功', icon: 'success' })
        applyUnpinOptimistic(event.selectedIds)
        editorPanelRef.value?.clearSelection()
        fetchAssetList(true, true)
        uni.$emit('collectionAssetsUpdated', { collectionId: collectionId.value })
      }
    }
    catch (error) {
      console.error('取消置顶素材失败', error)
      showCustomToast({ title: '取消置顶失败', icon: 'none' })
    }
    return
  }
  // 置底
  if (event.action === 'bottom') {
    try {
      if (pageType.value === 'asset') {
        await bottomMyAsset({ assetIds: event.selectedIds })
        showCustomToast({ title: '置底成功', icon: 'success' })
        applyBottomOptimistic(event.selectedIds)
        editorPanelRef.value?.clearSelection()
        fetchAssetList(true, true)
        uni.$emit('assetListNeedRefresh')
      }
      else {
        await bottomAsset({
          collectionId: collectionId.value,
          assetIds: event.selectedIds,
        })
        showCustomToast({ title: '置底成功', icon: 'success' })
        applyBottomOptimistic(event.selectedIds)
        editorPanelRef.value?.clearSelection()
        fetchAssetList(true, true)
        uni.$emit('collectionAssetsUpdated', { collectionId: collectionId.value })
      }
    }
    catch (error) {
      console.error('置底素材失败', error)
      showCustomToast({ title: '置底失败', icon: 'none' })
    }
    return
  }
}

// 页面触底由 scroll-view 的 scrolltolower 触发

// 拖拽期间禁止 scroll-view 滚动
const isDragging = ref(false)

function handleDragStateChange(active: boolean) {
  isDragging.value = active
}

function handleScrollEvent(e: any) {
  pageScrollStore.setScrollTop(e.detail?.scrollTop || 0)
  editorPanelRef.value?.handleScroll(e)
}

onPageScroll((e: any) => {
  pageScrollStore.setScrollTop(e.scrollTop || 0)
})

// 页面卸载时重置 canScroll 状态
onUnload(() => {
  pageScrollStore.setCanScroll(false)
  // 重置检查标志，下次进入页面可以重新检查
  hasCheckedCanScroll = false
})
</script>

<template>
  <view class="relative w-full overflow-hidden" :style="scrollViewStyle">
    <!-- 头部占位 -->
    <CommonHeader mode="fixed" :scroll-top="0" bg-color="#ffffff" />
    <!-- 页面标题 -->
    <custom-title
      :text="pageTitleText"
      :count="pageTitleCount"
      text-color="text-main"
    />

    <scroll-view
      id="collection-assets-scroll"
      ref="scrollViewRef"
      class="absolute left-0 top-0 w-full"
      :style="scrollViewStyle"
      :scroll-top="scrollTopValue"
      :scroll-y="!isDragging"
      :lower-threshold="150"
      :show-scrollbar="false"
      bounces="false"
      @scrolltolower="fetchAssetList()"
      @scroll="handleScrollEvent"
    >
      <!-- 有数据时显示列表 -->
      <view v-if="assetList.length > 0" class="page-content w-full" :style="{ paddingTop: `${statusNavTotalHeight}px` }">
        <editor-assets-panel
          ref="editorPanelRef"
          mode="edit" :items="assetList" :remove-btn-text="(pageType === 'asset' || userInfo.level === 4) ? '删除' : '移除'"
          hide-internal-footer
          :external-footer-height-px="footerHeightPx"
          @tab-change="handleTabChange"
          @changed="handleChanged"
          @drag-state-change="handleDragStateChange"
        />
      </view>

      <!-- 无数据时显示空状态 -->
      <fg-empty v-if="!pageState.loading && assetList.length === 0" />
    </scroll-view>

    <!--
      footer 必须放在 <scroll-view> 之外：
      微信小程序中 scroll-view 是原生组件,其内部 position: fixed 会被约束在 scroll-view
      渲染层内导致不显示 / 被遮挡。放到页面根下即可正常吸底。
    -->
    <view
      v-if="assetList.length > 0"
      id="emp-footer"
      class="fixed bottom-0 left-0 z-[999] w-full flex items-center justify-between bg-white pb-40rpx pt-20rpx"
    >
      <view class="h-[60rpx] flex flex-1 items-center justify-center text-[28rpx] text-tip" @tap.stop="editorPanelRef?.handlePin()">
        置顶
      </view>
      <view class="h-[60rpx] w-[2rpx] bg-[rgba(102,102,102,0.1)]" />
      <view class="h-[60rpx] flex flex-1 items-center justify-center text-[28rpx] text-[#666]" @tap.stop="editorPanelRef?.handleUnpin()">
        取消置顶
      </view>
      <view class="h-[60rpx] w-[2rpx] bg-[rgba(102,102,102,0.1)]" />
      <view class="h-[60rpx] flex flex-1 items-center justify-center text-[28rpx] text-[#666]" @tap.stop="editorPanelRef?.handleBottom()">
        置底
      </view>
      <view class="h-[60rpx] w-[2rpx] bg-[rgba(102,102,102,0.1)]" />
      <view
        class="h-[60rpx] flex flex-1 items-center justify-center text-[28rpx] text-error"
        @tap.stop="editorPanelRef?.handleRemove($event)"
      >
        {{ (pageType === 'asset' || userInfo.level === 4) ? '删除' : '移除' }}
      </view>
    </view>

    <!-- 删除/移除确认弹窗 -->
    <ConfirmPopup
      v-model:visible="showRemoveConfirmPopup"
      :title="isDeleteMode ? '删除素材' : '移除素材'"
      :message="`确认${isDeleteMode ? '删除' : '移除'}<b>${pendingRemoveIds.length}</b>个素材`"
      :confirm-text="isDeleteMode ? '确认删除' : '确认移除'"
      @confirm="handleConfirmRemove"
    />
  </view>
</template>

<style scoped lang="scss"></style>
