<script lang="ts" setup>
import type { AuditListItem } from '@/api/auditCenter/auditCenter'
import { onLoad, onPageScroll, onReachBottom, onShow } from '@dcloudio/uni-app'
import UTabs from 'uview-pro/components/u-tabs/u-tabs.vue'
import { reactive, ref } from 'vue'
import { clearAuditRecordByIds, getAuditList } from '@/api/auditCenter/auditCenter'
import { showCustomToast } from '@/composables/useCustomToast'
import { usePageScrollBridge } from '@/hooks/usePageScrollBridge'
import { usePageScrollStore } from '@/store/pageScroll'
import { usePreviewDetailsStore } from '@/store/previewDetails'
import { statusNavTotalHeight } from '@/utils/systemInfo'

const previewDetailsStore = usePreviewDetailsStore()
const pageScrollStore = usePageScrollStore()

usePageScrollBridge()

const customToTopBottom = ref('')

definePage({
  style: {
    navigationBarTitleText: '审核中心',
  },
})

const pageTitle = ref('审核中心')

// ========== Tab 切换栏 ==========
// Tab数据
const auditTabs = ref([
  { name: '审核中', auditStatus: 0 },
  { name: '已通过', auditStatus: 1 },
  { name: '已拒绝', auditStatus: 2 },
  { name: '已下架', auditStatus: undefined }, // 已下架通过saleStatus查询
])
const currentAuditTab = ref(0)

// 列表数据
const auditList = ref<AuditListItem[]>([])

// 分页状态
const pageState = reactive({
  nextCursorId: undefined as number | undefined,
  nextCursorSort: undefined as number | undefined,
  hasNext: true,
  loading: false,
})
// 瀑布流图片是否全部加载完成
const isWaterfallImagesLoaded = ref(false)

// 清空记录确认弹窗
const showClearConfirmPopup = ref(false)
const pendingClearIds = ref<number[]>([])

// 底部按钮高度：h-100rpx + pa-20rpx = 120rpx
// 有底部按钮时 ToTop bottom = 72rpx + 120rpx = 192rpx
// 底部按钮只在 currentAuditTab !== 0 && auditList.length > 0 时显示
watch(
  () => [currentAuditTab.value, auditList.value.length],
  ([tab, len]) => {
    if (tab !== 0 && len > 0) {
      customToTopBottom.value = '192rpx'
      pageScrollStore.setToTopBottom('192rpx')
    }
    else {
      customToTopBottom.value = ''
      pageScrollStore.setToTopBottom('')
    }
  },
  { immediate: true },
)

// 获取审核列表
async function fetchAuditList(isRefresh = false) {
  if (pageState.loading || (!pageState.hasNext && !isRefresh))
    return
  pageState.loading = true

  if (isRefresh) {
    auditList.value = []
    pageState.nextCursorId = undefined
    pageState.nextCursorSort = undefined
    pageState.hasNext = true
  }
  // 重置图片加载状态
  isWaterfallImagesLoaded.value = false

  try {
    const currentTab = auditTabs.value[currentAuditTab.value]
    const params: any = {
      pageSize: 20,
      ...(pageState.nextCursorId ? { cursorId: pageState.nextCursorId } : {}),
      ...(pageState.nextCursorSort ? { cursorSort: pageState.nextCursorSort } : {}),
    }

    // 已下架通过saleStatus查询，其他通过auditStatus查询
    if (currentTab.auditStatus === undefined) {
      params.saleStatus = 1 // 下架
    }
    else {
      params.auditStatus = currentTab.auditStatus
    }

    const res = await getAuditList(params)

    if (isRefresh) {
      auditList.value = res.records
    }
    else {
      auditList.value.push(...res.records)
    }

    pageState.nextCursorId = res.nextCursorId ?? undefined
    pageState.nextCursorSort = res.nextCursorScore ?? undefined
    pageState.hasNext = res.hasNext
  }
  catch (error) {
    console.error('获取审核列表失败:', error)
    showCustomToast({ title: '获取列表失败', icon: 'none' })
  }
  finally {
    pageState.loading = false
  }
}

// 处理Tab点击
function handleTabClick(index: number) {
  currentAuditTab.value = index
  // 切换tab时刷新列表
  fetchAuditList(true)
}

async function clearRecords() {
  const ids = auditList.value.map(item => item.id)
  if (ids.length === 0) {
    showCustomToast({ title: '暂无记录可清空', icon: 'none' })
    return
  }
  pendingClearIds.value = ids
  showClearConfirmPopup.value = true
}

async function handleConfirmClear() {
  try {
    uni.showLoading({ title: '清空中...' })
    await clearAuditRecordByIds({ ids: pendingClearIds.value })
    showCustomToast({ title: '清空成功', icon: 'success' })
    showClearConfirmPopup.value = false
    fetchAuditList(true)
  }
  catch (error) {
    console.error('清空审核记录失败:', error)
    showCustomToast({ title: '清空失败', icon: 'none' })
  }
  finally {
    uni.hideLoading()
  }
}

function handleItemClick(item: AuditListItem, index: number) {
  // 存储页面状态到store
  previewDetailsStore.setEntrySource('auditCenter')
  previewDetailsStore.setApiParams({
    auditCenter: {
      id: item.id,
      auditStatus: auditTabs.value[currentAuditTab.value].auditStatus,
      saleStatus: auditTabs.value[currentAuditTab.value].auditStatus === undefined ? 1 : undefined,
    },
  })
  previewDetailsStore.setCurrentItem(item, index)

  uni.navigateTo({
    url: `/pages/creativeSpace/previewDetails?id=${item.id}&source=assets`,
  })
}

// 处理素材失效，刷新列表
function handleAssetInvalid() {
  fetchAuditList(true)
}

// 页面触底加载更多
onReachBottom(() => {
  console.log('触底加载更多')
  fetchAuditList()
})

// 页面加载时获取数据
onLoad((options) => {
  // 如果有传入 tab 参数，切换到对应 tab
  if (options?.tab !== undefined) {
    const tabIndex = Number(options.tab)
    if (tabIndex >= 0 && tabIndex < auditTabs.value.length) {
      currentAuditTab.value = tabIndex
    }
  }
  fetchAuditList(true)
})

onShow(() => {
  pageScrollStore.setToTopBottom(customToTopBottom.value)
  setTimeout(() => {
    if (uni.getStorageSync('needRefreshFromException') === '1') {
      uni.removeStorageSync('needRefreshFromException')
      fetchAuditList(true)
    }
  }, 100)
})

onPageScroll((e) => {

})
</script>

<template>
  <view class="relative h-screen flex flex-col">
    <!-- 头部占位 -->
    <CommonHeader mode="fixed" :scroll-top="0" bg-color="#f5f5f5" />
    <!-- 页面标题 -->
    <custom-title :text="pageTitle" text-color="text-main" />

    <!-- Tab切换栏 -->
    <view
      class="fixed left-0 z-10 w-full px-16rpx"
      :style="{ top: `${statusNavTotalHeight}px` }"
    >
      <u-tabs
        :list="auditTabs"
        :is-scroll="false"
        item-width="100"
        active-color="#181818"
        inactive-color="#999"
        bg-color="#f5f5f5"
        :current="currentAuditTab"
        @change="handleTabClick"
      />
    </view>

    <!-- 内容区域 -->
    <view
      v-if="auditList.length > 0"
      :style="{ paddingTop: `${statusNavTotalHeight + (currentAuditTab === 0 || currentAuditTab === 1 ? 60 : 53)}px` }"
      class="pb-[calc(100rpx+env(safe-area-inset-bottom))]"
    >
      <!-- currentAuditTab为0和1时，展示瀑布流，其他状态展示列表 -->
      <FgWaterfall
        v-if="currentAuditTab === 0 || currentAuditTab === 1"
        :list="auditList"
        :has-top-label="false"
        :has-type-label="false"
        :has-bottom-info="false"
        scene="2"
        @item-click="handleItemClick"
        @asset-invalid="handleAssetInvalid"
        @all-images-loaded="isWaterfallImagesLoaded = true"
      />
      <!-- 底部提示：瀑布流有数据、没有下一页、且图片全部加载完成时显示 -->
      <view v-if="(currentAuditTab === 0 || currentAuditTab === 1) && !pageState.hasNext && !pageState.loading && isWaterfallImagesLoaded" class="py-40rpx text-center text-24rpx text-gray-400">
        - 到底了 -
      </view>

      <!-- currentAuditTab为2和3时，展示列表 -->
      <view v-if="currentAuditTab === 2 || currentAuditTab === 3" class="flex flex-col">
        <view
          v-for="(item, index) in auditList"
          :key="index"
          class="m-auto mb-24rpx w-686rpx flex items-center rounded-24rpx bg-white px-30rpx py-20rpx"
          @click="handleItemClick(item, index)"
        >
          <image
            :src="item.thumbUrl"
            class="h-92rpx w-92rpx rounded-8rpx object-cover"
            mode="aspectFill"
          />
          <text class="line-clamp-2 ml-24rpx flex-1 text-28rpx text-main leading-40rpx">
            {{ currentAuditTab === 2 ? item.rejectReason : item.saleDownReason }}
          </text>
        </view>
        <!-- 底部提示：列表有数据、没有下一页、且不在加载中时显示 -->
        <view v-if="!pageState.hasNext && !pageState.loading" class="py-40rpx text-center text-24rpx text-gray-400">
          - 到底了 -
        </view>
      </view>
      <!-- <view :style="{ height: 'calc(var(--safe-area-inset-bottom) + 140rpx)' }" /> -->
    </view>
    <!-- 空状态：与内容区域同级 -->
    <fg-empty v-if="auditList.length === 0 && !pageState.loading" class="flex-1" />
    <view
      v-if="currentAuditTab !== 0 && auditList.length > 0"
      class="fixed bottom-0 left-0 z-[999] w-full flex items-center justify-between bg-[#f5f5f5] pa-20rpx"
    >
      <view class="w-full flex justify-center px-30rpx">
        <view
          class="h-100rpx w-690rpx flex items-center justify-center border-2 border-[#333] rounded-50rpx border-solid transition-all duration-200"
          @click="clearRecords"
        >
          <text class="text-32rpx text-main font-bold">
            清空记录
          </text>
        </view>
      </view>
    </view>

    <!-- 清空记录确认弹窗 -->
    <ConfirmPopup
      v-model:visible="showClearConfirmPopup"
      title="清空记录"
      message="确认清空当前列表的所有记录？"
      confirm-text="确认清空"
      @confirm="handleConfirmClear"
    />
  </view>
</template>

<style scoped lang="scss">
</style>
