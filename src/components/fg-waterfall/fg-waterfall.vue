<script lang="ts" setup>
import type { AssetsDetail } from '@/api/common'
import { getCurrentInstance, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import { getAssetsDetail, getCategoryName } from '@/api/common'
import { showCustomToast } from '@/composables/useCustomToast'
import { debounce } from '@/utils/debounce'

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'itemClick', item: WaterfallItem, index: number, detail: AssetsDetail): void
  (e: 'assetInvalid'): void
  (e: 'allImagesLoaded'): void
}>()

const TAP_DEBOUNCE_MS = 300

/** 与模板一致：px-[20rpx] 左右 + flex gap-[20rpx] 两列间距 */
const COLUMN_COUNT = 3
const HORIZONTAL_PADDING_GAP_RPX = 40 + 40
/** 列内卡片间距 gap-[12rpx] */
const ITEM_GAP_RPX = 12
/** 默认宽高比（降级策略用） */
const DEFAULT_ASPECT_RATIO = 1
/** 卡片最小高宽比 1:1（宽:高），横图不低于正方形 */
const MIN_ASPECT_RATIO = 1
/** 卡片最大高宽比 1:2（宽:高），竖图不高于 2 倍列宽 */
const MAX_ASPECT_RATIO = 2

function clampDisplayAspectRatio(ratio: number): number {
  return Math.min(MAX_ASPECT_RATIO, Math.max(MIN_ASPECT_RATIO, ratio))
}
/** 每批处理数量 */
const BATCH_SIZE = 10
/** 缓存 key（v2：修正 webp GIF 错误缓存为 1:1 的问题） */
const CACHE_KEY = 'wf_aspect_ratio_cache_v2'
/** 缓存有效期（7天） */
const CACHE_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000

/** 加载中状态 */
const isLoading = ref(false)
/** 是否有待处理的图片比例请求 */
let hasPendingRatioRequests = false

function getColumnWidthRpx() {
  return (750 - HORIZONTAL_PADDING_GAP_RPX) / COLUMN_COUNT
}

/** 跨实例缓存宽高比，避免重复 getImageInfo；同一 URL 只请求一次 */
interface RatioResolveResult {
  ratio: number
  probeFailed: boolean
}

let thumbAspectRatioCache = new Map<string, number>()
const thumbAspectRatioInflight = new Map<string, Promise<RatioResolveResult>>()

/** 持久化缓存：启动时从 storage 恢复 */
function loadCacheFromStorage() {
  try {
    const raw = uni.getStorageSync(CACHE_KEY)
    if (raw) {
      const { data, timestamp } = JSON.parse(raw)
      if (Date.now() - timestamp < CACHE_EXPIRE_MS && data && typeof data === 'object') {
        thumbAspectRatioCache = new Map(Object.entries(data))
      }
    }
  }
  catch {
    // ignore
  }
}

/** 持久化缓存：定期写入 storage */
let cacheSaveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleCacheSave() {
  if (cacheSaveTimer)
    return
  cacheSaveTimer = setTimeout(() => {
    try {
      const data = Object.fromEntries(thumbAspectRatioCache)
      uni.setStorageSync(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }))
    }
    catch {
      // ignore
    }
    finally {
      cacheSaveTimer = null
    }
  }, 2000)
}

function isWebpUrl(url: string): boolean {
  return /\.webp(?:\?|$)/i.test(url)
}

/** GIF/动态 webp 缩略图用 staticThumbUrl 测比例，展示仍用 thumbUrl */
function getRatioProbeUrl(item: WaterfallItem): string {
  if (item.staticThumbUrl && (item.fileType === 2 || isWebpUrl(item.thumbUrl)))
    return item.staticThumbUrl
  return item.thumbUrl ?? ''
}

function probeImageRatioViaGetImageInfo(src: string): Promise<number | null> {
  return new Promise((resolve) => {
    uni.getImageInfo({
      src,
      success: (res) => {
        const w = res.width || 1
        const h = res.height || 1
        resolve(h / w)
      },
      fail: () => resolve(null),
    })
  })
}

function downloadAndProbeImageRatio(src: string): Promise<number | null> {
  if (!/^https?:\/\//i.test(src))
    return Promise.resolve(null)
  return new Promise((resolve) => {
    uni.downloadFile({
      url: src,
      success: (res) => {
        if (res.statusCode !== 200 || !res.tempFilePath) {
          resolve(null)
          return
        }
        probeImageRatioViaGetImageInfo(res.tempFilePath).then(resolve)
      },
      fail: () => resolve(null),
    })
  })
}

/** 获取宽高比（优先缓存）；探测失败时不写入缓存，便于 @load 降级修正 */
function getThumbAspectRatio(probeUrl: string): Promise<RatioResolveResult> {
  if (!probeUrl) {
    return Promise.resolve({ ratio: DEFAULT_ASPECT_RATIO, probeFailed: true })
  }
  const cached = thumbAspectRatioCache.get(probeUrl)
  if (cached != null) {
    return Promise.resolve({ ratio: cached, probeFailed: false })
  }
  let inflight = thumbAspectRatioInflight.get(probeUrl)
  if (!inflight) {
    inflight = (async () => {
      let ratio = await probeImageRatioViaGetImageInfo(probeUrl)
      if (ratio == null)
        ratio = await downloadAndProbeImageRatio(probeUrl)

      if (ratio != null) {
        thumbAspectRatioCache.set(probeUrl, ratio)
        scheduleCacheSave()
        return { ratio, probeFailed: false }
      }
      return { ratio: DEFAULT_ASPECT_RATIO, probeFailed: true }
    })().finally(() => {
      thumbAspectRatioInflight.delete(probeUrl)
    })
    thumbAspectRatioInflight.set(probeUrl, inflight)
  }
  return inflight
}

function getItemStableId(item: WaterfallItem): string {
  const raw = item.id ?? item.assetsId ?? item.contentId ?? item.interactionStateId ?? item.relationId
  return raw != null && raw !== '' ? String(raw) : ''
}

function getItemUniqueKey(item: WaterfallItem, index: number): string {
  const stable = getItemStableId(item)
  return stable ? `${stable}_${index}` : `idx_${index}`
}

function getListLayoutSignature(list: WaterfallItem[] | undefined): string {
  if (!list?.length) {
    return ''
  }
  return `${list.length}\u001D${list.map(i => `${getItemStableId(i)}\u001F${i.thumbUrl ?? ''}`).join('\u001E')}`
}

/** 不影响列布局、但影响卡片展示（置顶标签、分类、点赞数等）的字段签名 */
function getListDisplaySignature(list: WaterfallItem[] | undefined): string {
  if (!list?.length) {
    return ''
  }
  return list.map(i =>
    `${getItemStableId(i)}\u001F${i.isTop ?? 0}\u001F${i.categoryName ?? ''}\u001F${i.category ?? ''}\u001F${i.likeCountFormatted ?? ''}\u001F${i.downloadCountFormatted ?? ''}`,
  ).join('\u001E')
}

interface WaterfallItem {
  id: string | number
  relationId?: string | number
  sort?: number
  thumbUrl: string
  staticThumbUrl?: string
  originalImage?: string
  categoryName?: string
  category?: number
  isTop?: number
  hotScore?: number
  likeCountFormatted?: string
  downloadCountFormatted?: string
  scene?: '1' | '2'
  viewTime?: string
  fileType?: number
  [key: string]: any
}

interface Props {
  list: WaterfallItem[]
  hasTopLabel?: boolean
  hasTypeLabel?: boolean
  hasBottomInfo?: boolean
  scene?: '1' | '2'
}

function handleItemClick(item: WaterfallItem, index: number) {
  if (props.scene === '2') {
    emit('itemClick', item, index, null as any)
    return
  }
  getAssetsDetail({ assetsId: item.id || item.assetsId || item.entityId })
    .then((res) => {
      emit('itemClick', item, index, res)
    })
    .catch((error: any) => {
      console.log('获取素材详情失败', error)
      if (error?.code === 4100) {
        showCustomToast({
          icon: 'none',
          title: error.message || '素材不存在',
        })
        emit('assetInvalid')
      }
    })
}

const debouncedHandleItemClick = debounce(handleItemClick, TAP_DEBOUNCE_MS, { edges: ['leading'] })

// 修改点 1：使用 ref 以便精准侦测数组追加变化，避免重绘
const computedColumns = ref<{ item: WaterfallItem, index: number, height: number }[][]>([[], [], []])

let layoutToken = 0
let lastRenderedLength = 0
/**
 * 上次渲染后的首项 ID 与末项 ID，用于识别 tab 切换/数据重置场景。
 * 仅当新列表的 list[0] 与 list[lastRenderedLength - 1] 与上次一致时才走追加模式，
 * 避免纯靠 length 增加误判导致旧 tab 数据残留
 */
let lastFirstItemId: string | number = ''
let lastLastItemId: string | number = ''

/** 布局未变时同步列内 item 引用，避免父组件整表替换后仍渲染旧对象 */
function syncColumnItemsFromList(list: WaterfallItem[]) {
  if (lastRenderedLength === 0 || list.length !== lastRenderedLength)
    return

  for (const col of computedColumns.value) {
    for (const entry of col) {
      const latest = list[entry.index]
      if (latest)
        entry.item = latest
    }
  }
}

const itemInViewport = reactive<Record<string, boolean>>({})
/** getImageInfo 探测失败、待 @load 修正比例的卡片 */
const ratioProbePending = reactive<Record<string, boolean>>({})

function buildColumnsIncremental(token: number, list: WaterfallItem[], ratios: Map<number, number>, appendOnly: boolean) {
  if (token !== layoutToken)
    return
  const colWidthRpx = getColumnWidthRpx()

  // 全量重排模式
  if (lastRenderedLength === 0 || !appendOnly) {
    const cols: { item: WaterfallItem, index: number, height: number }[][] = Array.from({ length: COLUMN_COUNT }, () => [])
    const colHeights = Array.from({ length: COLUMN_COUNT }, () => 0)

    for (let i = 0; i < list.length; i++) {
      const rawRatio = ratios.get(i) ?? DEFAULT_ASPECT_RATIO
      const itemHeight = colWidthRpx * clampDisplayAspectRatio(rawRatio)
      let shortest = 0
      for (let c = 1; c < COLUMN_COUNT; c++) {
        if (colHeights[c] < colHeights[shortest]) {
          shortest = c
        }
      }
      cols[shortest].push({ item: list[i], index: i, height: itemHeight })
      colHeights[shortest] += itemHeight + ITEM_GAP_RPX
      const k = getItemUniqueKey(list[i], i)
      if (!(k in itemInViewport))
        itemInViewport[k] = true
    }

    computedColumns.value = cols
    lastRenderedLength = list.length
    return
  }

  // 追加模式
  if (list.length <= lastRenderedLength) {
    return
  }

  // 此时高度直接取之前精确记录的 entry.height 即可，无需求值浪费性能
  const colHeights = computedColumns.value.map((col) => {
    let h = 0
    col.forEach((entry) => {
      h += entry.height + ITEM_GAP_RPX
    })
    return h
  })

  for (let i = lastRenderedLength; i < list.length; i++) {
    const rawRatio = ratios.get(i) ?? DEFAULT_ASPECT_RATIO
    const itemHeight = colWidthRpx * clampDisplayAspectRatio(rawRatio)
    let shortest = 0
    for (let c = 1; c < COLUMN_COUNT; c++) {
      if (colHeights[c] < colHeights[shortest]) {
        shortest = c
      }
    }
    // 依赖 Vue3 ref 拦截 push 事件精确更新对应追加的节点，不影响已加载节点
    computedColumns.value[shortest].push({ item: list[i], index: i, height: itemHeight })
    colHeights[shortest] += itemHeight + ITEM_GAP_RPX

    const k = getItemUniqueKey(list[i], i)
    if (!(k in itemInViewport))
      itemInViewport[k] = true
  }

  lastRenderedLength = list.length
}

function handleThumbLoad(item: WaterfallItem, index: number, payload: { width: number, height: number }) {
  const key = getItemUniqueKey(item, index)
  if (!ratioProbePending[key])
    return

  const rawRatio = payload.height / payload.width
  const displayRatio = clampDisplayAspectRatio(rawRatio)
  const probeUrl = getRatioProbeUrl(item)
  if (probeUrl) {
    thumbAspectRatioCache.set(probeUrl, rawRatio)
    scheduleCacheSave()
  }
  delete ratioProbePending[key]

  const newHeight = getColumnWidthRpx() * displayRatio
  for (const col of computedColumns.value) {
    for (const entry of col) {
      if (entry.index !== index)
        continue
      if (Math.abs(entry.height - newHeight) < 0.5)
        return
      entry.height = newHeight
      return
    }
  }
}

async function rebuildBalancedColumns() {
  const list = props.list
  if (!Array.isArray(list) || list.length === 0) {
    if (lastRenderedLength > 0) {
      computedColumns.value = [[], [], []]
      lastRenderedLength = 0
      lastFirstItemId = ''
      lastLastItemId = ''
    }
    return
  }

  const token = ++layoutToken
  const currentList = list
  // 关键修复：仅当新列表前缀（首项 + 上次末项）与上次渲染保持一致时才可走追加模式，
  // 否则切换 tab/下拉刷新时会错误地表现为追加，导致旧数据残留在列中
  const newFirstId = getItemStableId(list[0])
  const newPrevLastId = list.length >= lastRenderedLength && lastRenderedLength > 0
    ? getItemStableId(list[lastRenderedLength - 1])
    : ''
  const isAppend = lastRenderedLength > 0
    && list.length > lastRenderedLength
    && newFirstId === lastFirstItemId
    && newPrevLastId === lastLastItemId

  if (!isAppend) {
    Object.keys(ratioProbePending).forEach((k) => {
      delete ratioProbePending[k]
    })
  }

  const ratios = new Map<number, number>()
  const pendingIndexes: number[] = []

  for (let i = 0; i < list.length; i++) {
    const probeUrl = getRatioProbeUrl(list[i])
    const cached = probeUrl ? thumbAspectRatioCache.get(probeUrl) : undefined
    if (cached != null) {
      ratios.set(i, cached)
      delete ratioProbePending[getItemUniqueKey(list[i], i)]
    }
    else {
      ratios.set(i, DEFAULT_ASPECT_RATIO)
      pendingIndexes.push(i)
    }
  }

  const total = pendingIndexes.length
  hasPendingRatioRequests = total > 0

  if (total > 0) {
    isLoading.value = true
    await nextTick()
  }

  if (layoutToken !== token)
    return

  // 修改点 2：必须把这一步放在加载完成之后统一进行！
  // 否则提前用 1:1 的高度推入，等获取到正确比例后再强行改变高度，一定会导致闪烁和排版误差。
  let loadedCount = 0
  for (let i = 0; i < pendingIndexes.length; i += BATCH_SIZE) {
    if (layoutToken !== token)
      return
    const batch = pendingIndexes.slice(i, i + BATCH_SIZE)
    const batchPromises = batch.map((index) => {
      const probeUrl = getRatioProbeUrl(currentList[index])
      return getThumbAspectRatio(probeUrl).then(result => ({ index, ...result }))
    })

    const batchResults = await Promise.all(batchPromises)
    if (layoutToken !== token)
      return

    batchResults.forEach(({ index, ratio, probeFailed }) => {
      ratios.set(index, ratio)
      const key = getItemUniqueKey(currentList[index], index)
      if (probeFailed)
        ratioProbePending[key] = true
      else
        delete ratioProbePending[key]
    })
    loadedCount += batch.length
  }

  // 修改点 3：所有未知的比例批量拉取完毕后，再推入列数组。以最高精度的计算保证完美填充且不产生重排
  if (layoutToken === token) {
    buildColumnsIncremental(token, currentList, ratios, isAppend)
    // 同步记录本次渲染后的首末项 ID，供下次追加校验使用
    lastFirstItemId = getItemStableId(currentList[0])
    lastLastItemId = getItemStableId(currentList[currentList.length - 1])

    await nextTick()
    isLoading.value = false
    hasPendingRatioRequests = false
    emit('allImagesLoaded')
  }
}

watch(
  () => [getListLayoutSignature(props.list), getListDisplaySignature(props.list)] as const,
  ([layoutSig, displaySig], prev) => {
    const prevLayoutSig = prev?.[0]
    const prevDisplaySig = prev?.[1]
    if (layoutSig !== prevLayoutSig) {
      rebuildBalancedColumns()
    }
    else if (displaySig !== prevDisplaySig) {
      syncColumnItemsFromList(props.list)
    }
  },
  { immediate: true },
)

loadCacheFromStorage()

let viewportObservers: UniApp.IntersectionObserver[] = []

function wfItemDomId(item: WaterfallItem, index: number): string {
  return `wf_${getItemUniqueKey(item, index).replace(/[^\w-]/g, '_')}`
}

function disconnectViewportObservers() {
  viewportObservers.forEach((o) => {
    try {
      o.disconnect()
    }
    catch {
      // ignore
    }
  })
  viewportObservers = []
  Object.keys(itemInViewport).forEach((k) => {
    delete itemInViewport[k]
  })
}

function createViewportIntersectionObserver(options: UniNamespace.CreateIntersectionObserverOptions) {
  const inst = getCurrentInstance()
  const ctx = inst && (inst as unknown as { ctx?: { createIntersectionObserver?: (o: UniNamespace.CreateIntersectionObserverOptions) => UniApp.IntersectionObserver } }).ctx
  if (ctx && typeof ctx.createIntersectionObserver === 'function') {
    return ctx.createIntersectionObserver(options)
  }
  return uni.createIntersectionObserver(undefined as any, options)
}

async function bindViewportObservers() {
  viewportObservers.forEach((o) => {
    try {
      o.disconnect()
    }
    catch {
      // ignore
    }
  })
  viewportObservers = []

  await nextTick()
  const flat = computedColumns.value.flat()

  const newKeys = new Set<string>()
  flat.forEach(({ item, index }) => {
    const key = getItemUniqueKey(item, index)
    newKeys.add(key)
    if (!(key in itemInViewport)) {
      itemInViewport[key] = true
    }
  })

  Object.keys(itemInViewport).forEach((k) => {
    if (!newKeys.has(k))
      delete itemInViewport[k]
  })

  for (const { item, index } of flat) {
    const key = getItemUniqueKey(item, index)
    if (itemInViewport[key])
      continue
    const selector = `#${wfItemDomId(item, index)}`
    const obs = createViewportIntersectionObserver({
      thresholds: [0, 0.01],
    })
    obs.relativeToViewport()
    obs.observe(selector, (res) => {
      if ((res.intersectionRatio ?? 0) > 0) {
        itemInViewport[key] = true
        try {
          obs.disconnect()
        }
        catch {
          // ignore
        }
      }
    })
    viewportObservers.push(obs)
  }
}

watch(
  computedColumns,
  () => {
    bindViewportObservers()
  },
  { flush: 'post', deep: true },
)

onUnmounted(() => {
  disconnectViewportObservers()
  if (cacheSaveTimer) {
    clearTimeout(cacheSaveTimer)
    cacheSaveTimer = null
  }
})
</script>

<template>
  <view class="flex items-start gap-[20rpx] px-[20rpx]">
    <view
      v-for="(col, colIndex) in computedColumns"
      :key="colIndex"
      class="w-0 flex flex-1 flex-col gap-[12rpx]"
    >
      <view
        v-for="{ item, index, height } in col"
        :id="wfItemDomId(item, index)"
        :key="getItemUniqueKey(item, index)"
        class="wf-item relative w-full overflow-hidden border-[8rpx] border-[#fff] rounded-lg border-solid"
        :style="{ height: `${height}rpx` }"
        @click="debouncedHandleItemClick(item, index)"
      >
        <ImagePlaceholder
          :src="item.thumbUrl"
          :webp="isWebpUrl(item.thumbUrl)"
          mode="aspectFill"
          class-name="h-full w-full !block"
          :placeholder-only="!itemInViewport[getItemUniqueKey(item, index)]"
          @load="handleThumbLoad(item, index, $event)"
        />

        <view v-if="hasTopLabel || hasTypeLabel" class="absolute left-[8rpx] top-[8rpx] center">
          <view
            v-if="hasTopLabel && item.isTop"
            class="mr-[8rpx] h-[44rpx] w-[64rpx] rounded-[8rpx] bg-[#477fff] text-center text-[20rpx] text-white font-bold line-height-[44rpx]"
          >
            置顶
          </view>
          <view
            v-if="hasTypeLabel"
            class="h-[44rpx] w-[64rpx] center rounded-[8rpx] bg-[rgba(24,24,24,0.5)] text-[20rpx] text-white font-bold leading-[44rpx]"
          >
            {{ item.categoryName || getCategoryName(item.category) }}
          </view>
        </view>
        <view
          v-if="hasBottomInfo"
          class="absolute bottom-0 left-0 box-border h-[100rpx] w-full flex items-end bg-[linear-gradient(0deg,rgba(24,24,24,1)0%,rgba(24,24,24,0)100%)] pa-[16rpx] text-[20rpx] text-white"
        >
          <view class="mr-20rpx center">
            <image src="/static/images/ic_heaet_off.png" class="h-28rpx w-28rpx" />
            <text class="ml-4rpx">{{ item.likeCountFormatted || '0' }}</text>
          </view>
          <view class="center">
            <image src="/static/images/ic_download.png" class="h-28rpx w-28rpx" />
            <text class="ml-4rpx">{{ item.downloadCountFormatted || '0' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
  <view v-if="isLoading" class="w-full flex items-center justify-center py-[40rpx] text-[28rpx] text-main">
    加载中...
  </view>
</template>

<style scoped lang="scss">
/**
 * 瀑布流卡片淡入动画：
 * - 首次挂载 / 切 tab / 筛选重置时，所有卡片是新 DOM → 整体柔和淡入
 * - 上拉加载更多时，依赖 Vue key-based 复用，仅新追加卡片重新触发动画，已有卡片不动
 * - 纯 CSS 实现，0 JS 成本，不影响响应式与滚动性能
 */
.wf-item {
  animation: wf-fade-in 600ms ease-out both;
}

@keyframes wf-fade-in {
  from {
    opacity: 0;
    transform: translate3d(0, 12rpx, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}
</style>
