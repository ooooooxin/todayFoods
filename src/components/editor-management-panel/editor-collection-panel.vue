/**
 * 编辑管理和添加作品通用组件  包含拖拽功能
 * 与 editor-assets-panel 一致：长按 + 容器 touch + 幽灵层跟随，避免 movable-area 抢占滑动
*/

<script lang="ts" setup>
import { onPageScroll } from '@dcloudio/uni-app'
import { computed, getCurrentInstance, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { showCustomToast } from '@/composables/useCustomToast'
import { statusNavTotalHeight, systemInfo } from '@/utils/systemInfo'

interface CollectionItem {
  id: string
  name: string
  count: number
  bg: string
  images: string[]
  shareCode?: string
  selected: boolean
}

interface Props {
  items: CollectionItem[]
  /**
   * 隐藏内置 footer。
   * 当本组件被放在微信小程序的 <scroll-view> 内部时，内置 footer 的 position: fixed 会失效
   * （scroll-view 是原生组件，fixed 子节点会被约束在其渲染层内），需要由父页面在 scroll-view
   * 之外自行渲染 footer，并通过 defineExpose 暴露的 handler 调用交互逻辑。
   */
  hideInternalFooter?: boolean
}

interface ChangedPayload {
  action: 'pin' | 'unpin' | 'bottom' | 'remove' | 'confirmAdd' | 'sort'
  selectedIds: Array<string | number>
  changed: boolean
  sortedList?: Array<{ id: string | number }>
  draggedId?: string | number
  previewIndex?: number
}

/**
 * 组件属性定义
 */
const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'changed', payload: ChangedPayload): void
  (e: 'dragStateChange', active: boolean): void
}>()

const isCopying = ref(false)

const instance = getCurrentInstance()

const upx2px = (rpx: number) => uni.upx2px(rpx)

/**
 * ============================================
 * 基础数据管理
 * ============================================
 */

// 内部副本：组件负责本地预览与排序效果，父组件持有源数据
const localItems = ref<CollectionItem[]>([])
watch(() => props.items, (val) => {
  localItems.value = JSON.parse(JSON.stringify(val || []))
}, { immediate: true, deep: true })

// 选中集合
const selected = reactive(new Set<string | number>())
const selectedCount = computed(() => selected.size)

const processedList = computed(() => {
  if (!localItems.value || !Array.isArray(localItems.value)) {
    return []
  }
  return localItems.value.map((item) => {
    const images = [...(item.images || [])]
    while (images.length < 4) {
      images.push('')
    }
    return { ...item, images }
  })
})

/**
 * 切换选中状态
 */
function toggleSelect(item: CollectionItem) {
  const id = item.id
  if (selected.has(id)) {
    selected.delete(id)
  }
  else {
    selected.add(id)
  }
}

function clearSelection() {
  selected.clear()
}

/**
 * 计算属性：列表数据（不区分置顶和非置顶）
 */
const itemList = computed(() => processedList.value)

/**
 * ============================================
 * 拖拽排序配置常量
 * ============================================
 */
const CELL_SIZE_RPX = 320
const GAP_RPX = 16
const LONG_PRESS_DELAY = 300
const MAX_DRAG_RANGE = 100

/**
 * ============================================
 * 滚动与布局状态
 * ============================================
 */
/** 与 editor-assets-panel 一致：页面滚动由外层 scroll-view 承担，用 onPageScroll 同步 */
const pageScrollTop = ref(0)
const headerHeightPx = ref(0)
const footerHeightPx = ref(0)

const contentStyle = computed(() => ({
  paddingTop: `${headerHeightPx.value}px`,
  paddingBottom: `${footerHeightPx.value}px`,
}))

/**
 * ============================================
 * 拖拽状态（与 editor-assets-panel 同思路）
 * ============================================
 */
const drag = reactive({
  active: false,
  dragIndex: -1,
  startIndex: -1,
  previewIndex: -1,
})

const screenWidth = systemInfo.screenWidth || 375
const areaPx = reactive({ rpxToPx: screenWidth > 0 ? screenWidth / 750 : 1 })
function rpx(val: number) {
  return val * areaPx.rpxToPx
}

const cellHeightPx = computed(() => rpx(CELL_SIZE_RPX))
const listContainerWidthPx = ref(0)
/** 幽灵层初始位置（传给子组件）；跟手位移由子组件 ref.setPosition 更新 */
const ghostInitX = ref(0)
const ghostInitY = ref(0)
const collectionGhostRef = ref<{ setPosition: (x: number, y: number) => void } | null>(null)

const gridCache = reactive({} as Record<string, { x: number, y: number }>)
const activeTransforms = reactive({} as Record<string, string>)

function computeXYByIndex(index: number) {
  const y = rpx(index * (CELL_SIZE_RPX + GAP_RPX))
  return { x: 12, y }
}

function rebuildGridCache() {
  itemList.value.forEach((item, idx) => {
    gridCache[item.id] = computeXYByIndex(idx)
  })
}

watch(itemList, rebuildGridCache, { immediate: true, deep: true })

function computeIndexByXY(_xPx: number, yPx: number, total: number) {
  const row = Math.max(0, Math.round(yPx / rpx(CELL_SIZE_RPX + GAP_RPX)))
  return Math.max(0, Math.min(total - 1, row))
}

const listAreaHeightPx = computed(() => {
  const n = itemList.value.length
  if (n === 0)
    return 0
  return rpx(n * (CELL_SIZE_RPX + GAP_RPX) + 12)
})

let ghostX = 0
let ghostY = 0

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

const PREVIEW_THROTTLE_MS = 100
let lastPreviewUpdate = 0
let lastGhostUpdateTime = 0

function measureContainerRect(): Promise<{ left: number, top: number, width: number }> {
  return new Promise((resolve) => {
    uni.createSelectorQuery().in(instance?.proxy).select('#emp-list-area').boundingClientRect((rect: any) => {
      resolve({
        left: rect?.left ?? 0,
        top: rect?.top ?? 0,
        width: rect?.width ?? 0,
      })
    }).exec()
  })
}

async function beginDrag(index: number) {
  const containerRect = await measureContainerRect()
  touchState.containerVpLeft = containerRect.left
  touchState.containerVpTop = containerRect.top
  listContainerWidthPx.value = containerRect.width

  const gridPos = computeXYByIndex(index)
  const itemVpX = containerRect.left + gridPos.x
  const itemVpY = containerRect.top + gridPos.y

  touchState.touchOffsetX = touchState.startX - itemVpX
  touchState.touchOffsetY = touchState.startY - itemVpY
  ghostX = itemVpX
  ghostY = itemVpY
  ghostInitX.value = itemVpX
  ghostInitY.value = itemVpY

  touchState.dragStartScroll = pageScrollTop.value

  drag.active = true
  emit('dragStateChange', true)
  drag.dragIndex = index
  drag.startIndex = index
  drag.previewIndex = index

  lastPreviewUpdate = Date.now()
  lastGhostUpdateTime = Date.now()

  await nextTick()
  collectionGhostRef.value?.setPosition(ghostX, ghostY)
}

function onContainerTouchStart(e: any) {
  const touch = e?.touches?.[0] || e?.changedTouches?.[0]
  if (!touch)
    return

  touchState.touchActive = true
  touchState.hasMoved = false
  touchState.startX = touch.clientX
  touchState.startY = touch.clientY
  drag.dragIndex = -1

  if (touchState.touchTimer)
    clearTimeout(touchState.touchTimer)

  measureContainerRect().then((rect) => {
    if (!touchState.touchActive)
      return
    const list = itemList.value
    if (list.length === 0)
      return

    const localX = touch.clientX - rect.left
    const localY = touch.clientY - rect.top

    const index = computeIndexByXY(localX, localY, list.length)
    const itemPos = computeXYByIndex(index)
    const w = rect.width
    if (localY >= itemPos.y && localY <= itemPos.y + cellHeightPx.value && localX >= 0 && localX <= w) {
      drag.dragIndex = index
    }
  })

  touchState.touchTimer = setTimeout(() => {
    if (touchState.touchActive && !touchState.hasMoved && drag.dragIndex >= 0)
      beginDrag(drag.dragIndex)
  }, LONG_PRESS_DELAY)
}

function calculateActiveTransforms(list: CollectionItem[], startIndex: number, previewIndex: number) {
  Object.keys(activeTransforms).forEach(k => delete activeTransforms[k])

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
    activeTransforms[list[i].id] = `translate3d(${dx}px, ${dy}px, 0)`
  }
}

function onContainerTouchMove(e: any) {
  const touch = e?.touches?.[0] || e?.changedTouches?.[0]
  if (!touch)
    return

  if (drag.active) {
    blockNativeScrollOnDrag(e)

    ghostX = touch.clientX - touchState.touchOffsetX
    ghostY = touch.clientY - touchState.touchOffsetY

    const now = Date.now()
    // 幽灵层仅降频 setPosition；不可在节流分支里 return 掉整段 touchmove，否则跟手会失效
    if (now - lastGhostUpdateTime >= 45) {
      lastGhostUpdateTime = now
      collectionGhostRef.value?.setPosition(ghostX, ghostY)
    }

    if (now - lastPreviewUpdate >= PREVIEW_THROTTLE_MS) {
      lastPreviewUpdate = now
      const scrollDelta = pageScrollTop.value - touchState.dragStartScroll
      const adjustedContainerTop = touchState.containerVpTop - scrollDelta

      const centerX = ghostX + listContainerWidthPx.value / 2 - touchState.containerVpLeft
      const centerY = ghostY + cellHeightPx.value / 2 - adjustedContainerTop
      const list = itemList.value
      const rawIndex = computeIndexByXY(centerX, centerY, list.length)

      const clampMin = Math.max(0, drag.startIndex - MAX_DRAG_RANGE)
      const clampMax = Math.min(list.length - 1, drag.startIndex + MAX_DRAG_RANGE)
      const newIndex = Math.max(clampMin, Math.min(clampMax, rawIndex))

      if (newIndex !== drag.previewIndex) {
        drag.previewIndex = newIndex
        calculateActiveTransforms(list, drag.startIndex, newIndex)
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
  }
}

function onContainerTouchEnd() {
  touchState.touchActive = false
  touchState.hasMoved = false
  if (touchState.touchTimer)
    clearTimeout(touchState.touchTimer)
  if (!drag.active) {
    drag.dragIndex = -1
    return
  }
  finishDrag()
}

function finishDrag() {
  const startIndex = drag.startIndex
  const previewIndex = drag.previewIndex
  const shouldSwap = previewIndex >= 0 && previewIndex !== startIndex

  drag.active = false
  emit('dragStateChange', false)
  drag.dragIndex = -1
  drag.startIndex = -1
  drag.previewIndex = -1

  Object.keys(activeTransforms).forEach(k => delete activeTransforms[k])

  let draggedItemId: string | number | undefined

  if (shouldSwap) {
    const list = itemList.value.slice()
    const moving = list.splice(startIndex, 1)[0]
    draggedItemId = moving.id
    list.splice(previewIndex, 0, moving)
    localItems.value = list
    emit('changed', {
      action: 'sort',
      selectedIds: [],
      changed: true,
      sortedList: localItems.value.map(item => ({ id: item.id })),
      draggedId: draggedItemId,
      previewIndex,
    })
    return
  }

  const item = itemList.value[startIndex]
  draggedItemId = item?.id
  emit('changed', {
    action: 'sort',
    selectedIds: [],
    changed: true,
    sortedList: localItems.value.map(item => ({ id: item.id })),
    draggedId: draggedItemId,
    previewIndex: startIndex,
  })
}

const draggedItem = computed(() => {
  if (!drag.active || drag.dragIndex < 0)
    return null
  return itemList.value[drag.dragIndex]
})

function isDraggedItem(index: number): boolean {
  return drag.active && drag.dragIndex === index
}

/**
 * ============================================
 * 滚动与布局
 * ============================================
 */

function measureFixedHeights() {
  const query = uni.createSelectorQuery().in(instance?.proxy)
  query.select('#emp-header').boundingClientRect()
  query.select('#emp-footer').boundingClientRect()
  query.exec((res) => {
    const header = Array.isArray(res) ? res[0] : undefined
    const footer = Array.isArray(res) ? res[1] : undefined
    headerHeightPx.value = header?.height ?? 0
    footerHeightPx.value = footer?.height ?? 0
  })
}

onMounted(() => {
  areaPx.rpxToPx = systemInfo.screenWidth / 750
  rebuildGridCache()
  measureFixedHeights()
  nextTick(measureFixedHeights)
})

onPageScroll((e) => {
  pageScrollTop.value = e.scrollTop ?? 0
})

/**
 * ============================================
 * 底部操作（edit模式）
 * ============================================
 */
function handleRemove() {
  const ids = Array.from(selected)
  if (!ids.length) {
    showCustomToast({ title: '请选择要删除的合集', icon: 'none' })
    return
  }
  emit('changed', { action: 'remove', selectedIds: ids, changed: true })
}

function preventPageScroll() {}

/** 拖拽时阻止默认滚动（与 editor-assets-panel 一致，配合父级 scroll-view 的 scroll-y=false） */
function blockNativeScrollOnDrag(e: any) {
  if (e?.cancelable === false)
    return
  e?.preventDefault?.()
  e?.stopPropagation?.()
}

defineExpose({
  clearSelection,
  handleRemove,
})

function copyPassword(password: string) {
  if (isCopying.value || !password)
    return

  isCopying.value = true

  uni.setClipboardData({
    data: password,
    success: () => {
      // 复制的toast必须用uni提供的，否则无法覆盖原生toast
      uni.showToast({ title: '口令已复制', icon: 'success' })
    },
    fail: (err) => {
      console.log('复制失败', err)
      // 复制的toast必须用uni提供的，否则无法覆盖原生toast
      uni.showToast({ title: '复制失败', icon: 'none' })
    },
    complete: () => {
      setTimeout(() => {
        isCopying.value = false
      }, 1000)
    },
  })
}
</script>

<template>
  <!-- 与 editor-assets-panel 一致：列表在普通 view 中，滚动由父页面 scroll-view + isDragging 控制 -->
  <view class="w-full">
    <!-- ============================================
         顶部区域
         ============================================ -->
    <view
      id="emp-header"
      class="fixed left-0 z-[999] box-border h-[80rpx] w-full flex items-center justify-between bg-white px-[20rpx]"
    >
      <text class="text-[28rpx] text-[#181818]">
        已选（{{ selectedCount }}）
      </text>
      <text class="text-[28rpx] text-tip">
        按住合集拖动即可进行排序
      </text>
    </view>

    <view class="pointer-events-none fixed left-0 w-full" :style="{ top: `${statusNavTotalHeight + upx2px(80)}px` }" style="height: 80rpx; background: linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0));" />

    <view class="box-border w-full pt-[16rpx]">
      <view :style="contentStyle" style="position: relative;">
        <view
          id="emp-list-area"
          class="relative w-full"
          :style="{
            height: `${listAreaHeightPx}px`,
            minHeight: `${listAreaHeightPx}px`,
            touchAction: drag.active ? 'none' : 'auto',
          }"
          @touchstart="onContainerTouchStart($event)"
          @touchmove="onContainerTouchMove($event)"
          @touchend="onContainerTouchEnd"
          @touchcancel="onContainerTouchEnd"
        >
          <view
            v-for="(item, index) in processedList"
            :key="item.id"
            class="absolute left-0 box-border w-full rounded-[16rpx] will-change-transform"
            :style="{
              width: '702rpx',
              minHeight: '200rpx',
              marginBottom: '12rpx',
              top: '0px',
              left: '0px',
              transform: activeTransforms[item.id]
                ? `translate3d(${gridCache[item.id]?.x || 0}px, ${gridCache[item.id]?.y || 0}px, 0) ${activeTransforms[item.id]}`
                : `translate3d(${gridCache[item.id]?.x || 0}px, ${gridCache[item.id]?.y || 0}px, 0)`,
              zIndex: isDraggedItem(index) ? 999 : 1,
              opacity: isDraggedItem(index) ? 0 : 1,
              transition: drag.active && activeTransforms[item.id] ? 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)' : 'none',
            }"
          >
            <view
              class="relative h-full w-full overflow-hidden rounded-[16rpx] bg-white"
              :style="{
                border: isDraggedItem(index) ? '4rpx solid #333' : '4rpx solid transparent',
                transition: 'border 0.2s ease',
              }"
              @tap="toggleSelect(item)"
            >
              <view class="relative z-2 box-border h-full flex flex-col px-[24rpx] pb-[22rpx] pt-[28rpx]">
                <view class="flex items-center justify-between text-[32rpx] text-[#333] font-600">
                  <view class="center">
                    <text>{{ item.name || '合集名称' }}</text>
                  </view>
                  <view class="center">
                    <text>({{ item.count || 0 }})</text>
                    <view class="relative ml-10rpx h-36rpx w-36rpx">
                      <image
                        v-if="selected.has(item.id)"
                        src="/static/images/ic_checkbox_on.png"
                        mode="scaleToFill"
                        class="h-full w-full"
                      />
                      <image
                        v-else
                        src="/static/images/ic_checkbox_off.png"
                        mode="scaleToFill"
                        class="h-full w-full"
                      />
                    </view>
                  </view>
                </view>
                <view class="mt-[20rpx] flex items-center justify-between font-600">
                  <view v-if="item.shareCode" class="inline-flex items-center border border-[rgba(102,102,102,0.1)] rounded-8rpx border-solid bg-[#F5F5F5] px-[12rpx] py-[4rpx]">
                    <text class="text-20rpx text-[#999] leading-[18px]">口令：</text>
                    <text class="ml-4rpx text-20rpx text-[#999] leading-[18px]">{{ item.shareCode }}</text>
                    <text class="ml-8rpx text-20rpx text-[#333] leading-[18px]" @tap.stop="copyPassword(item.shareCode)">复制</text>
                  </view>
                </view>
                <view class="relative mt-20rpx h-[150rpx]">
                  <view class="flex gap-[20rpx]">
                    <ImagePlaceholder
                      v-for="(img, idx) in item.images" :key="`${item.id}-${idx}`" :src="img"
                      mode="aspectFill" lazy-load webp class-name="h-[150rpx] w-[150rpx] rounded-[16rpx]"
                    />
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 幽灵层独立子组件，避免跟手时父级列表（大量 ImagePlaceholder）反复 setData -->
    <editor-collection-ghost
      v-if="drag.active && draggedItem"
      ref="collectionGhostRef"
      :active="drag.active"
      :item="draggedItem"
      :cell-height-px="cellHeightPx"
      :init-x="ghostInitX"
      :init-y="ghostInitY"
      :checkbox-on="draggedItem ? selected.has(draggedItem.id) : false"
    />

    <view
      v-if="drag.active"
      class="fixed inset-0 z-[9998]"
      style="background: transparent;"
      @touchmove.stop.prevent="preventPageScroll"
    />

    <template v-if="!props.hideInternalFooter">
      <!-- 底部删除按钮 - fixed布局置底 -->
      <view
        id="emp-footer"
        class="fixed bottom-0 left-0 right-0 z-50 box-border bg-white px-32rpx pb-40rpx pt-20rpx"
      >
        <view
          class="h-88rpx w-full center rounded-full bg-[#fff]"
          @click="handleRemove"
        >
          <text class="text-32rpx text-error font-bold">
            删除
          </text>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.custom-tabs {
  width: 100%;
  overflow: hidden;
}

.custom-tabs__nav {
  position: relative;
  display: flex;
  align-items: center;
  height: 80rpx;
}

.custom-tabs__nav-item {
  flex: none;
  padding: 0 20rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.3s;
}

.custom-tabs__nav-item-text {
  font-size: 16px;
  font-weight: normal;
  color: #999;
  transition: all 0.3s;
}

.custom-tabs__nav-item-text.is-active {
  font-size: 32rpx;
  font-weight: bold;
  color: #181818;
}

.custom-tabs__line {
  position: absolute;
  bottom: 0;
  height: 2px;
  background-color: #181818;
  transition: left 0.3s ease;
}

.will-change-transform {
  will-change: transform;
}
</style>
