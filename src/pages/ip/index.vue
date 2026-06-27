<script lang="ts" setup>
import type { IpAssetItem } from '@/api/ip/ip'
import { onPageScroll, onPullDownRefresh, onReachBottom, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { computed, onMounted, ref, watch } from 'vue'
import { getIps } from '@/api/ip/ip'
import { showCustomToast } from '@/composables/useCustomToast'
import { usePageScrollBridge } from '@/hooks/usePageScrollBridge'
import { useIpCollectionStore } from '@/store/ipCollection'
import { usePageScrollStore } from '@/store/pageScroll'
import { getImgUrl, getSearchKeywordParam } from '@/utils'
import { statusNavTotalHeight } from '@/utils/systemInfo'

const ipCollectionStore = useIpCollectionStore()
const pageScrollStore = usePageScrollStore()
usePageScrollBridge()

definePage({
  style: {
    navigationBarTitleText: 'IP',
    enablePullDownRefresh: true,
  },
})

// const headerScrollTop = ref(0)

/**
 * 搜索栏背景透明度
 * 页面滚动时背景透明渐变效果：
 * - 滚动距离 < statusNavTotalHeight：完全透明
 * - 滚动距离 >= statusNavTotalHeight：开始逐渐变白
 * - 滚动距离达到 statusNavTotalHeight + 20px 时：完全变白
 */
// const searchBarOpacity = computed(() => {
//   const scrollTop = headerScrollTop.value
//   const navHeight = statusNavTotalHeight || 88

//   // 搜索栏吸附位置 = navHeight + 40
//   // 开始渐变位置 = navHeight，结束渐变位置 = navHeight + 60px（快速过渡）
//   const startOpacityScroll = navHeight + 40
//   const endOpacityScroll = navHeight + 60

//   // 滚动距离小于导航栏高度，完全透明
//   if (scrollTop < startOpacityScroll) {
//     return 0
//   }

//   // 滚动距离超过结束位置，完全不透明
//   if (scrollTop >= endOpacityScroll) {
//     return 1
//   }

//   // 中间区间：逐渐变白
//   const opacity = (scrollTop - startOpacityScroll) / (endOpacityScroll - startOpacityScroll)
//   return opacity
// })

const keyword = ref('')
const ipList = ref<IpAssetItem[]>([])
const hasMore = ref(false)
const nextCursorId = ref('')
const nextCursorScore = ref('')
const isSearchEmpty = ref(false)
const isEmpty = computed(() => ipList.value.length === 0)
const isLoading = ref(false)
// 列表是否已完成至少一次加载（用于控制空状态展示）
const listLoaded = ref(false)

const searchBarHeight = computed(() => statusNavTotalHeight + uni.upx2px(138))

// 搜索防抖计时器
let searchTimer: ReturnType<typeof setTimeout> | null = null

// 监听输入变化，防抖搜索
watch(keyword, (newVal) => {
  // 清除之前的计时器
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  // 300ms 后触发搜索
  searchTimer = setTimeout(() => {
    // 重置分页状态
    nextCursorId.value = ''
    nextCursorScore.value = ''
    hasMore.value = false
    ipList.value = []
    isSearchEmpty.value = false
    loadIps(true)
  }, 300)
})

// 清空搜索
function handleClear() {
  keyword.value = ''
}

// 转换接口数据为组件需要的格式
const visibleList = computed(() => {
  return ipList.value.map(item => ({
    id: item.id,
    name: item.name,
    count: Number(item.assetTotal) || 0,
    countFormatted: item.assetTotalFormatted || '',
    engageCount: item.totalInteractionFormatted || '',
    interactionScore: item.totalInteraction || '',
    popCount: item.popularityStr || '',
    bg: item.desImgUrl || '',
    mainImg: item.mainImgUrl || '',
    avatarImgUrl: item.avatarImgUrl || '',
    images: item.previewAssets
      ? item.previewAssets.map(item => item.thumbUrl)
      : [],
  }))
})

// 加载更多数据
async function loadMore() {
  if (!hasMore.value || isLoading.value)
    return

  isLoading.value = true
  try {
    const params: {
      keyword?: string
      pageSize: number
      cursorId?: string
      interactionScore?: number
    } = {
      keyword: getSearchKeywordParam(keyword.value),
      pageSize: 10,
    }

    if (nextCursorId.value) {
      params.cursorId = nextCursorId.value
      params.interactionScore = Number(nextCursorScore.value) || 0
    }

    const data = await getIps(params)
    ipList.value = [...ipList.value, ...data.records]
    hasMore.value = data.hasNext
    nextCursorId.value = data.nextCursorId
    nextCursorScore.value = data.nextCursorScore
  }
  catch (error) {
    console.error('加载更多数据失败:', error)
  }
  finally {
    isLoading.value = false
  }
}

onReachBottom(() => {
  loadMore()
})

onPageScroll((e) => {
  // headerScrollTop.value = e.scrollTop ?? 0
})

// 页面加载时调用接口获取数据
async function loadIps(isRefresh = false) {
  listLoaded.value = false
  isLoading.value = true
  try {
    const params: {
      keyword?: string
      pageSize: number
      cursorId?: string
      interactionScore?: number
    } = {
      keyword: getSearchKeywordParam(keyword.value),
      pageSize: 10,
    }

    // 如果不是刷新且已有游标，则加载更多
    if (!isRefresh && nextCursorId.value) {
      params.cursorId = nextCursorId.value
      params.interactionScore = Number(nextCursorScore.value) || 0
    }

    const data = await getIps(params)

    if (isRefresh || !nextCursorId.value) {
      // 刷新或首次加载
      ipList.value = data.records
    }
    else {
      // 加载更多
      ipList.value = [...ipList.value, ...data.records]
    }

    hasMore.value = data.hasNext
    nextCursorId.value = data.nextCursorId
    nextCursorScore.value = data.nextCursorScore

    // 如果是搜索且返回数据为空，标记搜索空状态
    if (isRefresh && getSearchKeywordParam(keyword.value) && data.records.length === 0) {
      isSearchEmpty.value = true
    }
    else {
      isSearchEmpty.value = false
    }
  }
  catch (error) {
    console.error('获取IP资源列表失败:', error)
  }
  finally {
    isLoading.value = false
    listLoaded.value = true
  }
}

// 搜索
function onSearch() {
  // 重置分页状态
  nextCursorId.value = ''
  nextCursorScore.value = ''
  hasMore.value = false
  ipList.value = []
  isSearchEmpty.value = false
  loadIps(true)
}

onMounted(() => {
  loadIps(true)
})

onShow(() => {
  pageScrollStore.setToTopBottom('72rpx')
  setTimeout(() => {
    if (uni.getStorageSync('needRefreshFromException') === '1') {
      uni.removeStorageSync('needRefreshFromException')
      loadIps(true)
    }
  }, 100)
})

// 下拉刷新
const isRefreshing = ref(false)
onPullDownRefresh(async () => {
  if (isRefreshing.value)
    return
  isRefreshing.value = true
  try {
    // 重置分页状态
    nextCursorId.value = ''
    nextCursorScore.value = ''
    hasMore.value = false
    ipList.value = []
    isSearchEmpty.value = false
    await loadIps(true)
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

function handleClick(item: any) {
  const passedItemData = {
    id: item.id || '',
    name: item.name || '',
    avatarImgUrl: item.avatarImgUrl || null,
    interactionScore: item.interactionScore || '',
  }
  ipCollectionStore.setCurrentIpItem(passedItemData)
  const title = encodeURIComponent(item.name || '')
  const keywordParam = keyword.value ? `&keyword=${encodeURIComponent(keyword.value)}` : ''
  uni.navigateTo({ url: `/pages/ipCollectionDetails/index?id=${item.id}&title=${title}${keywordParam}` })
}

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
</script>

<template>
  <view class="h-screen flex flex-col">
    <CommonHeader mode="fixed" :scroll-top="0" bg-color="#fff" />
    <custom-title text="IP" text-color="text-main" />
    <!-- 顶部背景图区域 -->

    <!-- 搜索框 -->
    <view
      class="fixed left-0 z-10 w-full flex justify-center bg-white py-[30rpx]"
      :style="{
        top: `${statusNavTotalHeight}px`,
      }"
    >
      <view class="h-80rpx w-[690rpx] flex items-center rounded-45rpx bg-[#F5F5F5]">
        <image src="/src/static/images/ic_search.png" mode="scaleToFill" class="ml-[24rpx] h-40rpx w-40rpx" />
        <view class="h-full flex flex-1 items-center">
          <input
            v-model="keyword" class="h-full flex-1 pl-[20rpx] pr-[12rpx] text-28rpx text-main" type="text"
            placeholder="请输入IP名称" placeholder-style="color:#999;font-size:28rpx;"
          >
          <view
            v-if="keyword"
            class="mr-[12rpx] h-48rpx w-48rpx flex items-center justify-center"
            @click="handleClear"
          >
            <image
              src="/static/images/ic_clear.png"
              class="h-32rpx w-32rpx"
            />
          </view>
        </view>
        <view
          class="mr-[24rpx] border-l-[2rpx] border-l-[rgba(102,102,102,0.1)] border-solid b-b-none b-r-none b-t-none pl-24rpx text-28rpx text-main font-bold"
          @click="onSearch"
        >
          搜索
        </view>
      </view>
    </view>

    <view class="pointer-events-none fixed left-0 w-full" :style="{ top: `${searchBarHeight}px` }" style="height: 80rpx; background: linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0));" />

    <!-- 有数据时显示列表 -->
    <view v-if="ipList.length > 0" class="flex-1" :style="{ marginTop: `${searchBarHeight}px` }">
      <ip-collection-list
        :list="visibleList"
        :has-more="hasMore"
        mode="ip"
        @handle-click="handleClick"
      />
      <!-- 底部提示：有数据、没有下一页、且不在加载中时显示 -->
      <view v-if="!hasMore && !isLoading" class="py-40rpx text-center text-24rpx text-gray-400">
        - 到底了 -
      </view>
    </view>

    <!-- 无数据时显示空状态 -->
    <fg-empty v-if="listLoaded && isEmpty && !isLoading" type="content" :text="isSearchEmpty ? '未找到相关IP，换个关键词试试吧' : '没有内容'" class="flex-1" />
  </view>
</template>

<style lang="scss" scoped></style>
