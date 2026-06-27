/**
* 编辑管理和添加作品通用组件 包含拖拽功能
* 极限数据优化版：采用 O(1) 字典映射与 30FPS 降频，突破小程序 setData 通信瓶颈，支持大数据量流畅拖拽
*/

<script lang="ts" setup>
import type { CollectionAssetItem } from '@/api/ip/ip'
import type { MyAssetItem } from '@/api/me/me'
import { computed, getCurrentInstance, nextTick, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'
import { getCategoryName } from '@/api/common'
import { useCategoryFilter } from '@/composables/useCategoryFilter'
import { showCustomToast } from '@/composables/useCustomToast'
import { statusNavTotalHeight, systemInfo } from '@/utils/systemInfo'

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'changed', payload: ChangedPayload): void
  (e: 'tabChange', tabId: string, subTabId: string): void
  (e: 'subTabChange', subTabId: string): void
  (e: 'dragStateChange', active: boolean): void
}>()

// 删除 handleScrollToLower

type Mode = 'edit' | 'add'

interface Props {
  mode: Mode
  items: (CollectionAssetItem | MyAssetItem)[]
  removeBtnText?: string
  /**
   * 隐藏内置 footer。
   * 当本组件被放在微信小程序的 <scroll-view> 内部时，内置 footer 的 position: fixed 会失效
   * （scroll-view 是原生组件，fixed 子节点会被约束在其渲染层内），需要由父页面在 scroll-view
   * 之外自行渲染 footer，并通过 defineExpose 暴露的 handler 调用交互逻辑。
   */
  hideInternalFooter?: boolean
  /** 父页面固定在 scroll-view 外的 footer 高度（px）；传入后不再依赖组件内测量 #emp-footer */
  externalFooterHeightPx?: number
}

interface ChangedPayload {
  action: 'pin' | 'unpin' | 'bottom' | 'remove' | 'add' | 'sort'
  selectedIds: Array<string | number>
  changed: boolean
  /** 全量列表顺序（含置顶+普通），供父页面乐观更新 */
  sortedList?: Array<{ id: string | number }>
  /** 当前拖拽分区内排序后的列表，供计算 prevAssetId / nextAssetId */
  sortList?: Array<{ id: string | number }>
  draggedId?: string | number
  /** 在 sortList 内的下标，不是全量 sortedList 的下标 */
  previewIndex?: number
}

const instance = getCurrentInstance()

// defineExpose 移至函数定义之后（见文件底部 script 区域）

// ============================================
// 滚动状态追踪：防止快速滚动时误触选中（问题1）
// ============================================
let isScrolling = false
let scrollDebounceTimer: ReturnType<typeof setTimeout> | undefined
let lastScrollTime = 0
const SCROLL_GUARD_MS = 300 // 最后一次滚动事件后的保护期

const localItems = shallowRef<(CollectionAssetItem | MyAssetItem)[]>([])

const selected = ref<Set<string | number>>(new Set())
const selectedCount = computed(() => selected.value.size)

/**
 * 切换选中状态
 */
const MAX_SELECT_COUNT = 100

function toggleSelect(item: (CollectionAssetItem | MyAssetItem)) {
  // 滚动中或滚动刚结束的保护期内禁止选择，防止快速翻页误触
  if (isScrolling || Date.now() - lastScrollTime < SCROLL_GUARD_MS)
    return
  const id = item.id
  if (selected.value.has(id)) {
    selected.value.delete(id)
  }
  else {
    // 检查是否超出最大选择数量
    if (selected.value.size >= MAX_SELECT_COUNT) {
      showCustomToast({ title: `最多只能选择${MAX_SELECT_COUNT}个素材`, icon: 'none' })
      return
    }
    selected.value.add(id)
  }
}

function clearSelection() {
  selected.value.clear()
}

function isItemPinned(item: CollectionAssetItem | MyAssetItem) {
  return Number(item.isTop) === 1
}

function layoutItemKey(id: string | number) {
  return String(id)
}

const pinnedList = computed(() => localItems.value.filter(isItemPinned))
const unpinnedList = computed(() => localItems.value.filter(i => !isItemPinned(i)))

// 使用 composable 管理一级和二级分类（跟随变更）
const categoryFilter = useCategoryFilter({
  enableSubTabSync: true,
})

// Tabs
const innerTabIndex = ref(0)
// 二级标签
const innerSubTabIndex = ref(0)

function handleTabClick(index: number) {
  const tab = categoryFilter.tabs.value[index]
  if (!tab)
    return
  categoryFilter.selectTab(tab.id)
  innerTabIndex.value = index
  innerSubTabIndex.value = categoryFilter.currentSubTabIndex.value
  emit('tabChange', tab.id, categoryFilter.currentSubTabId.value)
}

function handleSubTabClick(index: number) {
  const tab = categoryFilter.subTabs.value[index]
  if (!tab)
    return
  categoryFilter.selectSubTab(tab.id)
  innerSubTabIndex.value = index
  emit('subTabChange', tab.id)
}

// 布局常量
const CELL_SIZE_RPX = 226
const GAP_RPX = 20
const PAD_RPX = 20
const COLS = 3
const LONG_PRESS_DELAY = 300
const MAX_DRAG_ROWS = 6
const MAX_DRAG_RANGE = COLS * MAX_DRAG_ROWS

// 渐变遮罩层top值计算
// edit模式：statusNavTotalHeight + header高度(80rpx)
// add模式：statusNavTotalHeight + tabs高度(80rpx) + (有二级分类时额外增加60rpx)
const gradientMaskTop = computed(() => {
  const baseHeight = statusNavTotalHeight
  const headerHeight = uni.upx2px(80)
  if (props.mode === 'edit') {
    return baseHeight + headerHeight
  }
  // add模式：tabs高度 + (有二级分类时额外高度)
  const subTabHeight = categoryFilter.hasSubTabs.value ? 51 : 0
  return baseHeight + headerHeight + subTabHeight
})

const pageScrollTop = ref(0)
const viewportHeightPx = ref(0)
const headerHeightPx = ref(0)
const footerHeightPx = ref(0)

// 触摸状态（声明在 handleScroll 之前，因为滚动事件中需要取消长按定时器）
const touchState = {
  touchOffsetX: 0,
  touchOffsetY: 0,
  containerVpLeft: 0,
  containerVpTop: 0,
  dragStartScroll: 0,
  touchActive: false,
  touchTimer: undefined as ReturnType<typeof setTimeout> | undefined,
  hasMoved: false,
  startX: 0,
  startY: 0,
}

function handleScroll(e: any) {
  pageScrollTop.value = e.detail?.scrollTop ?? 0
  // 标记正在滚动
  isScrolling = true
  lastScrollTime = Date.now()
  if (scrollDebounceTimer)
    clearTimeout(scrollDebounceTimer)
  // 滚动停止后 300ms 才允许选中操作（抖音真机需要更长保护期）
  scrollDebounceTimer = setTimeout(() => {
    isScrolling = false
  }, SCROLL_GUARD_MS)
  // 关键：scroll-view 接管触摸后子元素不再收到 touchmove，
  // 必须在此处主动取消长按定时器，否则滚动中会误触发拖拽排序
  if (touchState.touchTimer) {
    clearTimeout(touchState.touchTimer)
    touchState.touchTimer = undefined
  }
  touchState.touchActive = false
  touchState.hasMoved = true
  // 更新虚拟滚动可视范围
  updateVisibleRanges()
}

const contentStyle = computed(() => {
  // 父页面已将 scroll-view 高度设为 windowHeight - footer，此处不再重复 paddingBottom，避免底部留白过大
  const bottomPad = props.hideInternalFooter
    ? 0
    : footerHeightPx.value
  return {
    paddingTop: `${headerHeightPx.value - (categoryFilter.hasSubTabs.value ? 0 : 50)}px`,
    paddingBottom: `${bottomPad}px`,
  }
})

// ============================================
// 极限优化：使用静态网格缓存 + 独立响应式字典
// ============================================
const screenWidth = systemInfo.screenWidth || 375
const areaPx = reactive({ rpxToPx: screenWidth > 0 ? screenWidth / 750 : 1 })
function rpx(val: number) {
  return val * areaPx.rpxToPx
}
const cellSizePx = computed(() => rpx(CELL_SIZE_RPX))

// 响应式布局坐标：微信端模板需直接读 reactive 字段
const gridLayout = reactive({
  pinned: {} as Record<string, { x: number, y: number }>,
  unpinned: {} as Record<string, { x: number, y: number }>,
})

// 仅记录受到挤压而需要位移的元素的临时坐标差（O(1) 级别的按需更新）
const activeTransforms = reactive({
  pinned: {} as Record<string, string>,
  unpinned: {} as Record<string, string>,
})

function computeXYByIndex(index: number) {
  const col = index % COLS
  const row = Math.floor(index / COLS)
  return { x: rpx(PAD_RPX + col * (CELL_SIZE_RPX + GAP_RPX)), y: rpx(PAD_RPX + row * (CELL_SIZE_RPX + GAP_RPX)) }
}

// 可视行范围（置顶区固定全量渲染，仅普通区走虚拟滚动）
const visibleRange = reactive({
  pinnedStart: 0,
  pinnedEnd: 0,
  unpinnedStart: 0,
  unpinnedEnd: 60,
})

function syncZoneLayoutKeys(
  target: Record<string, { x: number, y: number }>,
  list: (CollectionAssetItem | MyAssetItem)[],
) {
  const alive = new Set<string>()
  list.forEach((item, idx) => {
    const key = layoutItemKey(item.id)
    alive.add(key)
    const pos = computeXYByIndex(idx)
    const prev = target[key]
    if (!prev || prev.x !== pos.x || prev.y !== pos.y)
      target[key] = pos
  })
  for (const key of Object.keys(target)) {
    if (!alive.has(key))
      delete target[key]
  }
}

function rebuildGridCache() {
  syncZoneLayoutKeys(gridLayout.pinned, pinnedList.value)
  syncZoneLayoutKeys(gridLayout.unpinned, unpinnedList.value)
  visibleRange.pinnedStart = 0
  visibleRange.pinnedEnd = pinnedList.value.length
}

function scheduleLayoutMeasure() {
  nextTick(() => {
    measureZoneScrollOffsets()
    forceUpdateVisibleRanges()
  })
}

// 仅同步可视范围与区域偏移；布局坐标由 props.items / finishDrag 触发 rebuild，避免重复 rebuild 导致全量重绘闪白
watch(() => [pinnedList.value.length, unpinnedList.value.length], () => {
  visibleRange.pinnedStart = 0
  visibleRange.pinnedEnd = pinnedList.value.length
  scheduleLayoutMeasure()
}, { immediate: true })

watch(() => props.items, (val) => {
  localItems.value = (val || []).slice()
  rebuildGridCache()
  scheduleLayoutMeasure()
}, { immediate: true })

function computeIndexByXY(xPx: number, yPx: number, total: number) {
  const col = Math.max(0, Math.min(COLS - 1, Math.floor((xPx - rpx(PAD_RPX)) / rpx(CELL_SIZE_RPX + GAP_RPX))))
  const row = Math.max(0, Math.floor((yPx - rpx(PAD_RPX)) / rpx(CELL_SIZE_RPX + GAP_RPX)))
  return Math.max(0, Math.min(total - 1, row * COLS + col))
}

// 容器高度（虚拟滚动：容器保持全量高度，撑起滚动区域）
const unpinnedAreaHeightPx = computed(() => Math.ceil(unpinnedList.value.length / COLS) === 0 ? 0 : rpx(PAD_RPX * 2 + Math.ceil(unpinnedList.value.length / COLS) * (CELL_SIZE_RPX + GAP_RPX)) - rpx(40))
const pinnedAreaHeightPx = computed(() => Math.ceil(pinnedList.value.length / COLS) === 0 ? 0 : rpx(PAD_RPX * 2 + Math.ceil(pinnedList.value.length / COLS) * (CELL_SIZE_RPX + GAP_RPX)) - rpx(40))

// ============================================
// 虚拟滚动：只渲染可视区域 + 缓冲区的元素
// 容器高度由全量数据计算（上方 areaHeight），DOM 节点仅渲染可见行
// ============================================
const VIRTUAL_BUFFER_ROWS = 8
const VIRTUAL_SKIP_THRESHOLD = 30 // 少于此数量不启用虚拟滚动

// 区域在滚动内容中的偏移（通过 createSelectorQuery 测量）
const zoneScrollOffset = { pinned: 0, unpinned: 0 }

function measureZoneScrollOffsets() {
  if (props.mode !== 'edit')
    return
  const currentScroll = pageScrollTop.value
  uni.createSelectorQuery().in(instance?.proxy).select('#emp-pinned-area').boundingClientRect().select('#emp-unpinned-area').boundingClientRect().exec((res: any[]) => {
    if (Array.isArray(res)) {
      if (res[0]?.top != null)
        zoneScrollOffset.pinned = res[0].top + currentScroll
      if (res[1]?.top != null)
        zoneScrollOffset.unpinned = res[1].top + currentScroll
    }
  })
}

function computeZoneVisibleRange(listLength: number, zoneOffset: number): { start: number, end: number } {
  if (listLength <= VIRTUAL_SKIP_THRESHOLD)
    return { start: 0, end: listLength }
  const rh = rpx(CELL_SIZE_RPX + GAP_RPX)
  const totalRows = Math.ceil(listLength / COLS)
  const scrollInZone = pageScrollTop.value - zoneOffset
  const firstRow = Math.max(0, Math.floor(scrollInZone / rh) - VIRTUAL_BUFFER_ROWS)
  const lastRow = Math.min(totalRows - 1, Math.ceil((scrollInZone + viewportHeightPx.value) / rh) + VIRTUAL_BUFFER_ROWS)
  return {
    start: firstRow * COLS,
    end: Math.min(listLength, (lastRow + 1) * COLS),
  }
}

let lastVisibleRangeUpdate = 0
const VISIBLE_RANGE_THROTTLE_MS = 32

function updateVisibleRanges() {
  const now = Date.now()
  if (now - lastVisibleRangeUpdate < VISIBLE_RANGE_THROTTLE_MS)
    return
  lastVisibleRangeUpdate = now
  _doUpdateVisibleRanges()
}

function forceUpdateVisibleRanges() {
  lastVisibleRangeUpdate = Date.now()
  _doUpdateVisibleRanges()
}

function _doUpdateVisibleRanges() {
  const pinnedLen = pinnedList.value.length
  if (visibleRange.pinnedStart !== 0 || visibleRange.pinnedEnd !== pinnedLen) {
    visibleRange.pinnedStart = 0
    visibleRange.pinnedEnd = pinnedLen
  }
  const ur = computeZoneVisibleRange(unpinnedList.value.length, zoneScrollOffset.unpinned)
  if (visibleRange.unpinnedStart !== ur.start || visibleRange.unpinnedEnd !== ur.end) {
    visibleRange.unpinnedStart = ur.start
    visibleRange.unpinnedEnd = ur.end
  }
}

// 拖拽状态（必须在 visibleItems 之前声明，避免 no-use-before-define）
const drag = reactive({
  active: false,
  zone: '' as 'pinned' | 'unpinned' | '',
  dragIndex: -1,
  startIndex: -1,
  previewIndex: -1,
})

// 普通区可视元素（置顶区直接 v-for pinnedList 全量渲染）
const visibleUnpinnedItems = computed(() => {
  const list = unpinnedList.value
  let start = visibleRange.unpinnedStart
  let end = Math.min(list.length, visibleRange.unpinnedEnd)
  if (drag.active && drag.zone === 'unpinned') {
    start = Math.min(start, Math.max(0, drag.startIndex - MAX_DRAG_RANGE))
    end = Math.max(end, Math.min(list.length, drag.startIndex + MAX_DRAG_RANGE + 1))
  }
  const result: { item: (typeof list)[0], index: number }[] = []
  for (let i = start; i < end; i++) {
    if (list[i])
      result.push({ item: list[i], index: i })
  }
  return result
})
let ghostX = 0
let ghostY = 0

// 降频配置：拉长目标判定时间，并将渲染锁死在 30帧/秒，彻底解放小程序的 setData
const PREVIEW_THROTTLE_MS = 100
let lastPreviewUpdate = 0
let lastGhostUpdateTime = 0

function measureContainerRect(zone: 'pinned' | 'unpinned'): Promise<{ left: number, top: number }> {
  return new Promise((resolve) => {
    uni.createSelectorQuery().in(instance?.proxy).select(zone === 'pinned' ? '#emp-pinned-area' : '#emp-unpinned-area').boundingClientRect((rect: any) => resolve({ left: rect?.left ?? 0, top: rect?.top ?? 0 })).exec()
  })
}

async function beginDrag(index: number, zone: 'pinned' | 'unpinned') {
  if (props.mode !== 'edit')
    return
  // 滚动中或刚滚动完毕不允许开始拖拽
  if (isScrolling || Date.now() - lastScrollTime < SCROLL_GUARD_MS)
    return

  const containerRect = await measureContainerRect(zone)
  touchState.containerVpLeft = containerRect.left
  touchState.containerVpTop = containerRect.top

  const gridPos = computeXYByIndex(index)
  const itemVpX = containerRect.left + gridPos.x
  const itemVpY = containerRect.top + gridPos.y

  touchState.touchOffsetX = touchState.startX - itemVpX
  touchState.touchOffsetY = touchState.startY - itemVpY
  ghostX = itemVpX
  ghostY = itemVpY
  uni.$emit('emp-ghost-move', { x: ghostX, y: ghostY })
  touchState.dragStartScroll = pageScrollTop.value

  drag.active = true
  // 通知父组件锁定滚动位置，传入当前滚动位置（问题3）
  emit('dragStateChange', true)
  drag.zone = zone
  drag.dragIndex = index
  drag.startIndex = index
  drag.previewIndex = index

  lastPreviewUpdate = Date.now()
  lastGhostUpdateTime = Date.now()
}

function onContainerTouchStart(e: any, zone: 'pinned' | 'unpinned') {
  if (props.mode !== 'edit')
    return
  const touch = e?.touches?.[0] || e?.changedTouches?.[0]
  if (!touch)
    return

  touchState.touchActive = true
  touchState.hasMoved = false
  touchState.startX = touch.clientX
  touchState.startY = touch.clientY
  drag.zone = zone
  drag.dragIndex = -1

  if (touchState.touchTimer)
    clearTimeout(touchState.touchTimer)

  measureContainerRect(zone).then((rect) => {
    if (!touchState.touchActive)
      return
    const localX = touch.clientX - rect.left
    const localY = touch.clientY - rect.top
    const list = zone === 'pinned' ? pinnedList.value : unpinnedList.value
    if (list.length === 0 || localY < 0)
      return

    const index = computeIndexByXY(localX, localY, list.length)
    const itemPos = computeXYByIndex(index)
    if (localX >= itemPos.x && localX <= itemPos.x + cellSizePx.value && localY >= itemPos.y && localY <= itemPos.y + cellSizePx.value) {
      drag.dragIndex = index
    }
  })

  touchState.touchTimer = setTimeout(() => {
    if (touchState.touchActive && !touchState.hasMoved && drag.dragIndex >= 0 && !isScrolling)
      beginDrag(drag.dragIndex, zone)
  }, LONG_PRESS_DELAY)
}

function calculateActiveTransforms(zone: 'pinned' | 'unpinned', list: any[], startIndex: number, previewIndex: number) {
  // 清理上一轮的动画缓存，保证非变动元素不带任何内联样式（避免无谓的重绘）
  activeTransforms[zone] = {}

  if (startIndex < 0 || previewIndex < 0 || startIndex === previewIndex)
    return

  const minIdx = Math.min(startIndex, previewIndex)
  const maxIdx = Math.max(startIndex, previewIndex)

  for (let i = minIdx; i <= maxIdx; i++) {
    if (i === startIndex)
      continue
    const visualIndex = startIndex < previewIndex ? i - 1 : i + 1
    const targetPos = computeXYByIndex(visualIndex)
    const originalPos = computeXYByIndex(i)
    const dx = targetPos.x - originalPos.x
    const dy = targetPos.y - originalPos.y
    // 只精准赋值给发生了挤压的元素
    activeTransforms[zone][layoutItemKey(list[i].id)] = `translate3d(${dx}px, ${dy}px, 0)`
  }
}

function onContainerTouchMove(e: any) {
  const touch = e?.touches?.[0] || e?.changedTouches?.[0]
  if (!touch)
    return

  if (drag.active) {
    const now = Date.now()
    // 强制截流：降频到 45ms（约 22fps），极大缓解低端机 setData 通信拥堵
    if (now - lastGhostUpdateTime < 45)
      return
    lastGhostUpdateTime = now

    ghostX = touch.clientX - touchState.touchOffsetX
    ghostY = touch.clientY - touchState.touchOffsetY
    uni.$emit('emp-ghost-move', { x: ghostX, y: ghostY })

    if (now - lastPreviewUpdate >= PREVIEW_THROTTLE_MS) {
      lastPreviewUpdate = now
      const scrollDelta = pageScrollTop.value - touchState.dragStartScroll
      const adjustedContainerTop = touchState.containerVpTop - scrollDelta

      const centerX = ghostX + cellSizePx.value / 2 - touchState.containerVpLeft
      const centerY = ghostY + cellSizePx.value / 2 - adjustedContainerTop
      const list = drag.zone === 'pinned' ? pinnedList.value : unpinnedList.value
      const rawIndex = computeIndexByXY(centerX, centerY, list.length)

      const clampMin = Math.max(0, drag.startIndex - MAX_DRAG_RANGE)
      const clampMax = Math.min(list.length - 1, drag.startIndex + MAX_DRAG_RANGE)
      const newIndex = Math.max(clampMin, Math.min(clampMax, rawIndex))

      if (newIndex !== drag.previewIndex) {
        drag.previewIndex = newIndex
        // 只有索引变了才去算位移，极其省性能
        calculateActiveTransforms(drag.zone as 'pinned' | 'unpinned', list, drag.startIndex, newIndex)
      }
    }
    return
  }

  if (!touchState.touchActive)
    return
  const dx = touch.clientX - touchState.startX
  const dy = touch.clientY - touchState.startY
  if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
    touchState.hasMoved = true
    touchState.touchActive = false
    if (touchState.touchTimer)
      clearTimeout(touchState.touchTimer)
    drag.dragIndex = -1
    drag.zone = ''
  }
}

function onContainerTouchEnd() {
  touchState.touchActive = false
  touchState.hasMoved = false
  if (touchState.touchTimer)
    clearTimeout(touchState.touchTimer)
  if (!drag.active) {
    drag.dragIndex = -1
    drag.zone = ''
    return
  }
  finishDrag()
}

function finishDrag() {
  const startIndex = drag.startIndex
  const previewIndex = drag.previewIndex
  const zone = drag.zone
  const shouldSwap = previewIndex >= 0 && previewIndex !== startIndex

  drag.active = false
  emit('dragStateChange', false)
  drag.zone = ''
  drag.dragIndex = -1
  drag.startIndex = -1
  drag.previewIndex = -1

  activeTransforms.pinned = {}
  activeTransforms.unpinned = {}

  let draggedItemId: string | number | undefined
  let zoneSortList: Array<{ id: string | number }> = []

  if (shouldSwap) {
    if (zone === 'pinned') {
      const list = pinnedList.value.slice()
      const moving = list.splice(startIndex, 1)[0]
      draggedItemId = moving.id
      list.splice(previewIndex, 0, moving)
      localItems.value = [...list, ...unpinnedList.value.slice()]
      zoneSortList = list.map(item => ({ id: item.id }))
    }
    else {
      const list = unpinnedList.value.slice()
      const moving = list.splice(startIndex, 1)[0]
      draggedItemId = moving.id
      list.splice(previewIndex, 0, moving)
      localItems.value = [...pinnedList.value.slice(), ...list]
      zoneSortList = list.map(item => ({ id: item.id }))
    }
    rebuildGridCache()
  }
  else {
    const zoneList = zone === 'pinned' ? pinnedList.value : unpinnedList.value
    draggedItemId = zoneList[startIndex]?.id
    zoneSortList = zoneList.map(item => ({ id: item.id }))
  }

  const zonePreviewIndex = shouldSwap ? previewIndex : startIndex

  emit('changed', {
    action: 'sort',
    selectedIds: [],
    changed: true,
    sortedList: localItems.value.map(item => ({ id: item.id })),
    sortList: zoneSortList,
    draggedId: draggedItemId,
    previewIndex: zonePreviewIndex,
  })
}

const draggedItem = computed(() => {
  if (!drag.active || drag.dragIndex < 0)
    return null
  return drag.zone === 'pinned' ? pinnedList.value[drag.dragIndex] : unpinnedList.value[drag.dragIndex]
})

function measureFixedHeights() {
  uni.createSelectorQuery().in(instance?.proxy).select('#emp-header').boundingClientRect().exec((res) => {
    headerHeightPx.value = (Array.isArray(res) ? res[0] : undefined)?.height ?? 0
  })
  if (props.hideInternalFooter) {
    if (props.externalFooterHeightPx != null && props.externalFooterHeightPx > 0)
      footerHeightPx.value = props.externalFooterHeightPx
    return
  }
  uni.createSelectorQuery().in(instance?.proxy).select('#emp-footer').boundingClientRect().exec((res) => {
    footerHeightPx.value = (Array.isArray(res) ? res[0] : undefined)?.height ?? 0
  })
}

watch(() => props.externalFooterHeightPx, (h) => {
  if (props.hideInternalFooter && h != null && h > 0)
    footerHeightPx.value = h
})

onMounted(() => {
  viewportHeightPx.value = systemInfo.windowHeight || 0
  measureFixedHeights()
  // 首次测量区域偏移，初始化虚拟滚动
  nextTick(() => {
    measureZoneScrollOffsets()
    forceUpdateVisibleRanges()
  })
  try {
    ;(globalThis as any).tt?.setSwipeBackMode?.({ mode: 0 })
  }
  catch (e) { }
})

onUnmounted(() => {
  try {
    ;(globalThis as any).tt?.setSwipeBackMode?.({ mode: 1 })
  }
  catch (e) { }
})

// 移除 onPageScroll（在 scroll-view 内部的组件中无效，会产生不必要的计算开销）（问题2）
// 滚动位置由父组件通过 @scroll -> handleScroll 传入

function handlePin() {
  if (isScrolling || Date.now() - lastScrollTime < SCROLL_GUARD_MS)
    return
  const ids = Array.from(selected.value)
  if (!ids.length)
    return showCustomToast({ title: '请选择要操作的素材', icon: 'none' })
  const unpinnedIds = ids.filter((id) => {
    const item = localItems.value.find(i => i.id === id)
    return item && !isItemPinned(item)
  })
  if (!unpinnedIds.length)
    return showCustomToast({ title: '请选择未置顶的素材', icon: 'none' })
  emit('changed', { action: 'pin', selectedIds: unpinnedIds, changed: true })
}

function handleUnpin() {
  if (isScrolling || Date.now() - lastScrollTime < SCROLL_GUARD_MS)
    return
  const ids = Array.from(selected.value)
  if (!ids.length)
    return showCustomToast({ title: '请选择要操作的素材', icon: 'none' })
  const pinnedIds = ids.filter((id) => {
    const item = localItems.value.find(i => i.id === id)
    return item && isItemPinned(item)
  })
  if (!pinnedIds.length)
    return showCustomToast({ title: '请选择已置顶的素材', icon: 'none' })
  emit('changed', { action: 'unpin', selectedIds: pinnedIds, changed: true })
}

function handleBottom() {
  if (isScrolling || Date.now() - lastScrollTime < SCROLL_GUARD_MS)
    return
  const ids = Array.from(selected.value)
  if (!ids.length)
    return showCustomToast({ title: '请选择要操作的素材', icon: 'none' })
  emit('changed', { action: 'bottom', selectedIds: ids, changed: true })
}

function handleRemove(e?: any) {
  if (isScrolling || Date.now() - lastScrollTime < SCROLL_GUARD_MS)
    return
  if (e?.type && e.type !== 'tap')
    return
  const ids = Array.from(selected.value)
  if (!ids.length) {
    showCustomToast({ title: '请选择要操作的素材', icon: 'none' })
    return
  }
  emit('changed', { action: 'remove', selectedIds: ids, changed: true })
}

function handleReset() {
  clearSelection()
}

function handleConfirmAdd() {
  if (isScrolling || Date.now() - lastScrollTime < SCROLL_GUARD_MS)
    return
  const ids = Array.from(selected.value)
  if (!ids.length)
    return showCustomToast({ title: '请选择要操作的素材', icon: 'none' })
  emit('changed', { action: 'add', selectedIds: ids, changed: true })
}

function preventPageScroll() {
  // 空函数：仅用于阻止 touchmove 事件冒泡
}

defineExpose({
  clearSelection,
  handleScroll,
  // 以下供父页面在 scroll-view 外渲染 footer 时使用（配合 props.hideInternalFooter）
  selectedCount,
  handlePin,
  handleUnpin,
  handleBottom,
  handleRemove,
  handleReset,
  handleConfirmAdd,
})
</script>

<template>
  <view class="w-full">
    <view
      v-if="props.mode === 'edit'" id="emp-header"
      class="fixed left-0 z-[999] box-border h-[80rpx] w-full flex items-center justify-between bg-white px-[20rpx]"
    >
      <text class="text-[28rpx] text-[#181818]">已选（{{ selectedCount }}）</text>
      <text class="text-[28rpx] text-tip">按住图片拖动即可进行排序</text>
    </view>
    <view
      v-else id="emp-header" class="fixed left-0 z-[999] w-full bg-white px-[20rpx]"
      :style="{ top: `${statusNavTotalHeight}px` }"
    >
      <view class="h-[80rpx] flex items-center">
        <u-tabs
          :list="categoryFilter.tabs.value"
          :is-scroll="true"
          item-width="100"
          gutter="0"
          active-color="#181818"
          inactive-color="#999"
          :current="categoryFilter.currentTabIndex.value"
          @change="handleTabClick"
        />
      </view>
      <!-- 二级分类 -->
      <view v-if="categoryFilter.hasSubTabs.value" class="flex items-center gap-2 py-2">
        <view
          v-for="(tab, index) in categoryFilter.subTabs.value" :key="tab.id"
          class="box-border flex shrink-0 items-center justify-center rounded-full px-24rpx py-16rpx text-[24rpx] transition-all duration-200"
          :class="categoryFilter.currentSubTabIndex.value === index ? 'bg-primary text-white border-[2rpx] border-solid border-primary font-medium' : 'bg-white text-[#666] border-[2rpx] border-solid border-[#E5E5E5]'"
          @click="handleSubTabClick(index)"
        >
          <text class="block leading-none">{{ tab.name }}</text>
        </view>
      </view>
    </view>

    <view class="pointer-events-none fixed left-0 w-full" :style="{ top: `${gradientMaskTop}px` }" style="height: 80rpx; background: linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0));" />

    <view class="box-border w-full">
      <view :style="contentStyle" style="position: relative;">
        <view
          v-if="props.mode === 'edit'" id="emp-pinned-area" class="relative w-full"
          :style="{ height: `${pinnedAreaHeightPx}px` }" @touchstart="onContainerTouchStart($event, 'pinned')"
          @touchmove="onContainerTouchMove($event)" @touchend="onContainerTouchEnd"
          @touchcancel="onContainerTouchEnd"
        >
          <view
            v-for="(item, index) in pinnedList" :key="`pinned-${item.id}-${index}`"
            class="absolute rounded-[16rpx] will-change-transform"
            :style="{
              width: `${cellSizePx}px`,
              height: `${cellSizePx}px`,
              left: `${gridLayout.pinned[String(item.id)]?.x ?? 0}px`,
              top: `${gridLayout.pinned[String(item.id)]?.y ?? 0}px`,
              transform: activeTransforms.pinned[String(item.id)] || 'none',
              zIndex: drag.active && drag.zone === 'pinned' && drag.dragIndex === index ? 999 : 1,
              opacity: drag.active && drag.zone === 'pinned' && drag.dragIndex === index ? 0 : 1,
              transition: drag.active && activeTransforms.pinned[String(item.id)] ? 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)' : 'none',
            }"
          >
            <view class="relative h-full w-full overflow-hidden border-[8rpx] border-[#333] rounded-[16rpx] border-solid" @tap="toggleSelect(item)">
              <image
                :src="item.thumbUrl" mode="aspectFill" lazy-load
                class="absolute left-0 top-0 h-full w-full rounded-[12rpx]"
              />
              <view class="absolute left-[16rpx] top-[16rpx]">
                <view
                  class="mr-[8rpx] h-[36rpx] w-[72rpx] rounded-[8rpx] bg-[#477fff] text-center text-[20rpx] text-white font-bold line-height-[36rpx]"
                >
                  置顶
                </view>
              </view>
              <view class="absolute right-[16rpx] top-[16rpx]" @tap.stop="toggleSelect(item)">
                <view class="relative h-[36rpx] w-[36rpx]">
                  <image v-if="selected.has(item.id)" src="/static/images/ic_checkbox_on.png" class="h-full w-full" />
                  <image v-else src="/static/images/ic_checkbox_off.png" class="h-full w-full" />
                </view>
              </view>
              <view class="absolute bottom-[16rpx] left-[16rpx]">
                <view
                  class="h-[44rpx] w-[64rpx] rounded-[8rpx] bg-[rgba(24,24,24,0.5)] text-center text-[20rpx] text-white font-bold line-height-[44rpx]"
                >
                  {{ item.categoryName || getCategoryName(item.category) }}
                </view>
              </view>
            </view>
          </view>
        </view>

        <view v-if="props.mode === 'add' && pinnedList.length > 0" class="pa-[20rpx] pb-0">
          <view class="grid grid-cols-3 gap-[20rpx]">
            <view
              v-for="item in pinnedList" :key="`top-${item.id}`"
              class="relative box-border h-[226rpx] w-[226rpx] overflow-hidden border-[8rpx] border-white rounded-[16rpx] border-solid bg-[#f0f0f0] p-[16rpx]"
              @tap="toggleSelect(item)"
            >
              <image
                :src="item.thumbUrl" mode="aspectFill"
                class="absolute left-0 top-0 h-full w-full rounded-[12rpx]"
              />
              <view class="absolute left-[16rpx] top-[16rpx]">
                <view
                  class="mr-[8rpx] h-[36rpx] w-[72rpx] rounded-[8rpx] bg-[#477fff] text-center text-[20rpx] text-white font-bold line-height-[36rpx]"
                >
                  置顶
                </view>
              </view>
              <view class="absolute right-[16rpx] top-[16rpx]" @tap.stop="toggleSelect(item)">
                <view class="relative h-[36rpx] w-[36rpx]">
                  <image v-if="selected.has(item.id)" src="/static/images/ic_checkbox_on.png" class="h-full w-full" />
                  <image v-else src="/static/images/ic_checkbox_off.png" class="h-full w-full" />
                </view>
              </view>
              <view class="absolute bottom-[16rpx] left-[16rpx]">
                <view
                  class="h-[44rpx] w-[64rpx] rounded-[8rpx] bg-[rgba(24,24,24,0.5)] text-center text-[20rpx] text-white font-bold line-height-[44rpx]"
                >
                  {{ item.categoryName || getCategoryName(item.category) }}
                </view>
              </view>
            </view>
          </view>
        </view>

        <view
          v-if="props.mode === 'edit'" id="emp-unpinned-area" class="relative w-full"
          :style="{ height: `${unpinnedAreaHeightPx}px` }" @touchstart="onContainerTouchStart($event, 'unpinned')"
          @touchmove="onContainerTouchMove($event)" @touchend="onContainerTouchEnd"
          @touchcancel="onContainerTouchEnd"
        >
          <view
            v-for="{ item, index } in visibleUnpinnedItems" :key="`unpinned-${item.id}-${index}`"
            class="absolute rounded-[16rpx] will-change-transform"
            :style="{
              width: `${cellSizePx}px`,
              height: `${cellSizePx}px`,
              left: `${gridLayout.unpinned[String(item.id)]?.x ?? 0}px`,
              top: `${gridLayout.unpinned[String(item.id)]?.y ?? 0}px`,
              transform: activeTransforms.unpinned[String(item.id)] || 'none',
              zIndex: drag.active && drag.zone === 'unpinned' && drag.dragIndex === index ? 999 : 1,
              opacity: drag.active && drag.zone === 'unpinned' && drag.dragIndex === index ? 0 : 1,
              transition: drag.active && activeTransforms.unpinned[String(item.id)] ? 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)' : 'none',
            }"
          >
            <view class="relative h-full w-full overflow-hidden border-[8rpx] border-white rounded-[16rpx] border-solid" @tap="toggleSelect(item)">
              <image
                :src="item.thumbUrl" mode="aspectFill" lazy-load
                class="absolute left-0 top-0 h-full w-full rounded-[12rpx]"
              />
              <view class="absolute right-[16rpx] top-[16rpx]" @tap.stop="toggleSelect(item)">
                <view class="relative h-[36rpx] w-[36rpx]">
                  <image v-if="selected.has(item.id)" src="/static/images/ic_checkbox_on.png" class="h-full w-full" />
                  <image v-else src="/static/images/ic_checkbox_off.png" class="h-full w-full" />
                </view>
              </view>
              <view class="absolute bottom-[16rpx] left-[16rpx]">
                <view
                  class="h-[44rpx] w-[64rpx] rounded-[8rpx] bg-[rgba(24,24,24,0.5)] text-center text-[20rpx] text-white font-bold line-height-[44rpx]"
                >
                  {{ item.categoryName || getCategoryName(item.category) }}
                </view>
              </view>
            </view>
          </view>
        </view>

        <view v-else class="pa-[20rpx]">
          <view class="grid grid-cols-3 gap-[20rpx]">
            <view
              v-for="item in unpinnedList" :key="`normal-${item.id}`"
              class="relative box-border h-[226rpx] w-[226rpx] overflow-hidden border-[8rpx] border-white rounded-[16rpx] border-solid p-[16rpx]"
              @tap="toggleSelect(item)"
            >
              <image :src="item.thumbUrl" mode="aspectFill" class="absolute left-0 top-0 h-full w-full rounded-[12rpx]" />
              <view class="absolute right-[16rpx] top-[16rpx]" @tap.stop="toggleSelect(item)">
                <view class="relative h-[36rpx] w-[36rpx]">
                  <image v-if="selected.has(item.id)" src="/static/images/ic_checkbox_on.png" class="h-full w-full" />
                  <image v-else src="/static/images/ic_checkbox_off.png" class="h-full w-full" />
                </view>
              </view>
              <view class="absolute bottom-[16rpx] left-[16rpx]">
                <view
                  class="h-[44rpx] w-[64rpx] rounded-[8rpx] bg-[rgba(24,24,24,0.5)] text-center text-[20rpx] text-white font-bold line-height-[44rpx]"
                >
                  {{ item.categoryName || getCategoryName(item.category) }}
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 使用分离的事件驱动幽灵组件以切断渲染连锁反应 -->
    <editor-assets-ghost
      :active="drag.active"
      :item="draggedItem"
      :cell-size="cellSizePx"
      :zone="drag.zone"
      :init-x="ghostX"
      :init-y="ghostY"
    />

    <view
      v-if="drag.active" class="fixed inset-0 z-[9998]" style="background: transparent;"
      @touchmove.stop.prevent="preventPageScroll"
    />

    <template v-if="!props.hideInternalFooter">
      <view
        v-if="props.mode === 'edit'" id="emp-footer"
        class="fixed bottom-0 left-0 z-[999] w-full flex items-center justify-between bg-white pb-40rpx pt-20rpx"
      >
        <view class="h-[60rpx] flex flex-1 items-center justify-center text-[28rpx] text-tip" @tap.stop="handlePin">
          置顶
        </view>
        <view class="h-[60rpx] w-[2rpx] bg-[rgba(102,102,102,0.1)]" />
        <view class="h-[60rpx] flex flex-1 items-center justify-center text-[28rpx] text-[#666]" @tap.stop="handleUnpin">
          取消置顶
        </view>
        <view class="h-[60rpx] w-[2rpx] bg-[rgba(102,102,102,0.1)]" />
        <view class="h-[60rpx] flex flex-1 items-center justify-center text-[28rpx] text-[#666]" @tap.stop="handleBottom">
          置底
        </view>
        <view class="h-[60rpx] w-[2rpx] bg-[rgba(102,102,102,0.1)]" />
        <view
          class="h-[60rpx] flex flex-1 items-center justify-center text-[28rpx] text-error"
          @tap.stop="handleRemove($event)"
        >
          {{ props.removeBtnText || '移除' }}
        </view>
      </view>
      <view
        v-else id="emp-footer"
        class="fixed bottom-0 left-0 z-[999] w-full flex items-center justify-between bg-white pb-40rpx pt-20rpx"
      >
        <view class="h-[60rpx] flex flex-1 items-center justify-center text-[28rpx] text-[#666]" @tap="handleReset">
          重选
        </view>
        <view class="h-[60rpx] w-[2rpx] bg-[rgba(102,102,102,0.1)]" />
        <view class="h-[60rpx] flex flex-1 items-center justify-center text-[28rpx] text-tip" @tap="handleConfirmAdd">
          确认添加（{{ selectedCount }}）
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.will-change-transform {
  will-change: transform;
}
</style>
