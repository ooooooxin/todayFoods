<script lang="ts" setup>
import type { MyAssetItem } from '@/api/me/me'
import { onHide, onLoad, onPageScroll, onPullDownRefresh, onReachBottom, onShow, onUnload } from '@dcloudio/uni-app'
import UTabs from 'uview-pro/components/u-tabs/u-tabs.vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { getAuditStatistics } from '@/api/auditCenter/auditCenter'
import { getMyAssetList, getMyCollectionList } from '@/api/me/me'
import CreateCollection from '@/components/create-collection/create-collection.vue'
import IpCollectionList from '@/components/ip-collection-list/ip-collection-list.vue'
import { useCategoryFilter } from '@/composables/useCategoryFilter'
import { showCustomToast } from '@/composables/useCustomToast'
import {
  CREATIVE_STICKY_ONE_ROW_RPX,
  CREATIVE_STICKY_TWO_ROWS_RPX,
  getCreativeSpaceTabFilterBarTopPx,
  getListSectionMinHeightStyle,
} from '@/constants/listSectionLayout'
import { usePageScrollBridge } from '@/hooks/usePageScrollBridge'
import { useCreativeSpaceStore } from '@/store/creativeSpace'
import { usePageScrollStore } from '@/store/pageScroll'
import { usePreviewDetailsStore } from '@/store/previewDetails'
import { useUserStore } from '@/store/user'
import { getImgUrl } from '@/utils'
import { statusNavTotalHeight } from '@/utils/systemInfo'

const userStore = useUserStore()
const creativeSpaceStore = useCreativeSpaceStore()
const previewDetailsStore = usePreviewDetailsStore()

const userInfo = computed(() => userStore.userInfo)

definePage({
  style: {
    navigationBarTitleText: '创作空间',
    enablePullDownRefresh: true,
  },
})

// 同步页面滚动到全局 store，供 App.ku 中「回到顶部」使用（H5 等环境下与自动注入互补）
usePageScrollBridge()

const pageScrollStore = usePageScrollStore()
const customToTopBottom = ref('')
/** 与首页一致：筛选栏（Tab 区）是否已吸顶、吸顶时 pageScrollTo 的目标 scrollTop */
const isFilterSticky = ref(false)
const filterStickyScrollTop = ref(0)
// 排序筛选状态
const isSortOpen = ref(false)
const currentSortId = ref<string>('')

onPageScroll((e) => {
  if (pageScrollStore.interactionDisabled) {
    return
  }
  const st = e.scrollTop ?? 0
  pageScrollStore.setScrollTop(st)
  const filterBarTop = getCreativeSpaceTabFilterBarTopPx()
  isFilterSticky.value = st >= filterBarTop
  if (isFilterSticky.value)
    filterStickyScrollTop.value = filterBarTop
  // 页面滚动时隐藏排序筛选下拉
  if (isSortOpen.value)
    isSortOpen.value = false
})

// 页面加载时注册事件监听
onLoad(() => {
  uni.$off('collectionListNeedRefresh')
  uni.$off('assetListNeedRefresh')
  // 监听合集列表需要刷新的事件
  uni.$on('collectionListNeedRefresh', () => {
    fetchCollectionList()
  })
  // 监听素材列表需要刷新的事件
  uni.$on('assetListNeedRefresh', () => {
    fetchAssetList(true)
  })
})

// ========== Tab 切换栏 ==========
// 主Tab：创作/合集计数
const assetTotal = ref(0)
const collectionTotal = ref(0)

const upx2px = (rpx: number) => uni.upx2px(rpx)

const currentMainTab = ref(0)

const gradientMaskTop = computed(() => {
  if (currentMainTab.value === 0) {
    return statusNavTotalHeight + 44 + upx2px(94)
  }
  return statusNavTotalHeight + 44
})

// 审核统计数据
const auditStatistics = ref({
  auditingNum: 0,
  passAudited: 0,
  rejectNum: 0,
})

// 主Tab：创作/合集
const mainTabs = computed(() => [
  { name: `创作·${assetTotal.value}` },
  { name: `合集·${collectionTotal.value}` },
])
// 底部操作条高度：h-[60rpx] + pb-40rpx + pt-20rpx = 120rpx
// 有底部操作条时 ToTop bottom = 72rpx + 120rpx = 192rpx
// 底部操作条在 !(userInfo.level === 4 && currentMainTab === 1) 时显示
watch(
  () => [userInfo.value.level, currentMainTab.value],
  ([level, tab]) => {
    if (!(level === 4 && tab === 1)) {
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

/** 列表区 min-height：100vh - 导航 - sticky（创作=双行 Tab，合集=单行）- 底部固定操作条 */
const listSectionMinHeightStyle = computed(() =>
  getListSectionMinHeightStyle({
    stickyHeightRpx: currentMainTab.value === 0 ? CREATIVE_STICKY_TWO_ROWS_RPX : CREATIVE_STICKY_ONE_ROW_RPX,
    // bottomReserveRpx: 100,
  }),
)

// 使用 composable 管理一级和二级分类（不跟随变更）
const categoryFilter = useCategoryFilter({
  enableSubTabSync: false,
})

// 当前选中的次级Tab索引
const currentSubTab = ref(0)

// 排序筛选显示文本
const currentSortText = computed(() => {
  return categoryFilter.subTabDisplayText.value
})

// 瀑布流数据（创作素材）
const waterfallData = ref<MyAssetItem[]>([])

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

// 合集列表数据（从store获取）
const collectionList = computed(() => creativeSpaceStore.collectionList)

// 获取合集列表
async function fetchCollectionList() {
  try {
    const res = await getMyCollectionList()
    // 更新合集总数
    collectionTotal.value = res?.total || 0
    // 映射到组件要求的属性
    const list = (res?.records || []).map((item: any) => ({
      ...item,
      name: item.title,
      count: item.assetCount,
      countFormatted: item.assetCountFormatted,
      popCount: item.popularityStr,
      bg: item.coverUrl,
      images: item.topAssets?.map((a: any) => a.thumbUrl) || [],
    }))
    // 存储到store
    creativeSpaceStore.setCollectionList(list)
  }
  catch (error) {
    console.error('获取合集失败', error)
  }
}

// 获取素材列表
async function fetchAssetList(isRefresh = false) {
  if (pageState.loading || (!pageState.hasNext && !isRefresh))
    return
  pageState.loading = true

  if (isRefresh) {
    pageState.nextCursorId = undefined
    pageState.nextCursorScore = undefined
    pageState.hasNext = true
  }
  // 重置图片加载状态
  isWaterfallImagesLoaded.value = false

  try {
    const categoryId = categoryFilter.currentTabId.value
    const res = await getMyAssetList({
      pageSize: 20,
      cursorId: pageState.nextCursorId,
      sortOrder: pageState.nextCursorScore,
      cursorIsTop: pageState.nextCursorIsTop,
      category: categoryId ? Number(categoryId) : undefined,
      fileType: categoryFilter.currentSubTabId.value ? Number(categoryFilter.currentSubTabId.value) : undefined,
    })

    if (isRefresh) {
      waterfallData.value = []
      waterfallData.value = res.records
      // 更新素材总数
      assetTotal.value = res?.total || 0
    }
    else {
      waterfallData.value.push(...res.records)
    }

    pageState.nextCursorId = res.nextCursorId ?? undefined
    pageState.nextCursorIsTop = res.nextCursorIsTop ?? undefined
    pageState.nextCursorScore = res.nextCursorScore ?? undefined
    pageState.hasNext = res.hasNext
  }
  catch (error) {
    console.error('获取素材列表失败', error)
  }
  finally {
    pageState.loading = false
  }
}

// 创建/编辑合集弹窗
const createCollectionVisible = ref(false)
const createCollectionType = ref<'create' | 'edit'>('create')
const editingCollectionName = ref('')
const editingCollectionId = ref<number>()

// 打开创建合集弹窗
function openCreateCollection() {
  createCollectionType.value = 'create'
  createCollectionVisible.value = true
}

// 打开编辑合集弹窗
function openEditName(item: any) {
  createCollectionType.value = 'edit'
  editingCollectionName.value = item.name
  editingCollectionId.value = item.id
  createCollectionVisible.value = true
}

// 跳转合集素材页面
function toCollectionAssets(item: any) {
  uni.navigateTo({
    url: `/pages/creativeSpace/colledtionAssets?id=${item.id}&name=${item.name}`,
  })
}

// 处理主Tab点击
function handleMainTabClick(index: number) {
  if (currentMainTab.value === index)
    return
  currentMainTab.value = index
  // 切换 tab 时隐藏下拉菜单
  closeSort()
  if (isFilterSticky.value) {
    uni.pageScrollTo({
      scrollTop: filterStickyScrollTop.value,
      duration: 0,
    })
  }
}

// 处理次级Tab点击
function handleSubTabClick(index: number) {
  const tab = categoryFilter.tabs.value[index]
  if (!tab || categoryFilter.currentTabId.value === tab.id)
    return
  // 切换 tab 时隐藏下拉菜单
  closeSort()
  categoryFilter.selectTab(tab.id)
  if (isFilterSticky.value) {
    uni.pageScrollTo({
      scrollTop: filterStickyScrollTop.value,
      duration: 0,
    })
  }
  fetchAssetList(true)
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
  // 刷新列表
  fetchAssetList(true)
}

// 处理瀑布流item点击
function handleWaterfallItemClick(item: any, index: number) {
  // 存储页面状态到store
  previewDetailsStore.setEntrySource('creativeSpaceIndex')
  previewDetailsStore.setApiParams({
    creativeSpaceIndex: {
      category: categoryFilter.currentTabId.value ? Number(categoryFilter.currentTabId.value) : undefined,
      fileType: categoryFilter.currentSubTabId.value ? Number(categoryFilter.currentSubTabId.value) : undefined,
    },
  })
  previewDetailsStore.setCurrentItem(item, index)

  uni.navigateTo({
    url: `/pages/creativeSpace/previewDetails?id=${item.id}&source=assets`,
  })
}

// 处理素材失效，刷新列表
function handleAssetInvalid() {
  fetchAssetList(true)
}

// 页面触底事件，加载更多素材
onReachBottom(() => {
  if (currentMainTab.value === 0) {
    fetchAssetList()
  }
})

// 获取审核统计数据
async function fetchAuditStatistics() {
  try {
    const res = await getAuditStatistics()
    auditStatistics.value = {
      auditingNum: res.auditingNum || 0,
      passAudited: res.passAudited || 0,
      rejectNum: res.rejectNum || 0,
    }
  }
  catch (error) {
    console.error('获取审核统计失败', error)
  }
}

// 页面挂载时获取数据
onMounted(() => {
  fetchCollectionList()
  fetchAssetList(true)
})

// 页面显示时刷新审核数据
onShow(() => {
  pageScrollStore.setToTopBottom(customToTopBottom.value)
  fetchAuditStatistics()
  // 检查是否有需要刷新的异常情况
  setTimeout(() => {
    if (uni.getStorageSync('needRefreshFromException') === '1') {
      uni.removeStorageSync('needRefreshFromException')
      fetchCollectionList()
      fetchAssetList(true)
    }
  }, 100)
})

// 页面隐藏时隐藏下拉菜单
onHide(() => {
  closeSort()
})

// 页面卸载时设置标记，表示从创作空间返回
onUnload(() => {
  uni.setStorageSync('fromCreativeSpace', '1')
})

const clickLeftBtn = () => {
  if (currentMainTab.value === 0) {
    uni.navigateTo({
      url: '/pages/upload/index',
    })
  }
  else {
    if (collectionTotal.value >= 50) {
      showCustomToast({
        title: '合集数量已达上限',
        icon: 'none',
      })
      return
    }
    openCreateCollection()
  }
}

const clickRightBtn = () => {
  if (currentMainTab.value === 0) {
    uni.navigateTo({
      url: '/pages/creativeSpace/editCollectionAssets?name=编辑管理',
    })
  }
  else {
    uni.navigateTo({
      url: '/pages/creativeSpace/editCollection',
    })
  }
}

// 跳转审核中心
const toAuditCenter = (tab?: number) => {
  uni.navigateTo({ url: `/pages/creativeSpace/auditCenter?tab=${tab}` })
}

// 下拉刷新
const isRefreshing = ref(false)
onPullDownRefresh(async () => {
  if (isRefreshing.value || pageScrollStore.interactionDisabled) {
    uni.stopPullDownRefresh()
    return
  }
  isRefreshing.value = true
  try {
    // 重置数据状态
    waterfallData.value = []
    creativeSpaceStore.setCollectionList([])

    await Promise.all([
      fetchAuditStatistics(),
      fetchAssetList(true),
      fetchCollectionList(),
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
  <view class="min-h-screen flex flex-col">
    <CommonHeader mode="auto" :scroll-top="0" />
    <custom-title text="创作空间" text-color="text-main" />
    <!-- 背景图 -->
    <image class="fixed left-0 top-0 h-686rpx w-full" src="/static/images/creator_bg.png" mode="scaleToFill" />

    <!-- 固定顶部区域 -->
    <view
      v-if="!createCollectionVisible"
      class="fixed left-0 top-0 z-50 w-full overflow-hidden"
      :style="{ height: `${statusNavTotalHeight}px` }"
    >
      <image class="h-full w-full" src="/static/images/creator_bg.png" mode="widthFix" />
    </view>

    <!-- 统计卡片 -->
    <view class="relative z-10 m-auto h-246rpx w-[686rpx] overflow-hidden pt-20rpx">
      <image
        class="h-246rpx w-full object-cover"
        :src="getImgUrl('/assets/mp/temp/shzx1.png')"
        mode="widthFix"
      />
      <view
        class="absolute bottom-32rpx left-1/2 box-border h-136rpx w-638rpx flex items-center px-20rpx py-20rpx -translate-x-1/2"
      >
        <!-- 审核中 -->
        <view class="h-full flex flex-1 flex-col items-center justify-center" @tap="toAuditCenter(0)">
          <text class="text-44rpx text-white font-bold">{{ auditStatistics.auditingNum }}</text>
          <text class="mt-8rpx text-24rpx text-[#CDCDCD]">审核中</text>
        </view>
        <!-- 已通过 -->
        <view class="h-full flex flex-1 flex-col items-center justify-center b-x-[2rpx] b-x-[rgba(102,102,102,0.4)] b-x-solid" @tap="toAuditCenter(1)">
          <text class="text-44rpx text-white font-bold">{{ auditStatistics.passAudited }}</text>
          <text class="mt-8rpx text-24rpx text-[#CDCDCD]">已通过</text>
        </view>
        <!-- 已拒绝 -->
        <view class="h-full flex flex-1 flex-col items-center justify-center" @tap="toAuditCenter(2)">
          <text class="text-44rpx text-error font-bold">{{ auditStatistics.rejectNum }}</text>
          <text class="mt-8rpx text-24rpx text-[#CDCDCD]">已拒绝</text>
        </view>
      </view>
    </view>

    <!-- 内容区域 -->
    <view class="relative z-10 flex flex-1 flex-col">
      <!-- 标签栏容器：粘性布局 -->
      <view
        class="sticky z-20 rounded-t-32rpx bg-white"
        :style="{ top: `${statusNavTotalHeight}px` }"
      >
        <!-- 第一行：主Tab切换栏 -->
        <view class="overflow-hidden rounded-t-[32rpx] px-16rpx">
          <u-tabs
            :list="mainTabs"
            :is-scroll="true"
            item-width="200"
            gutter="0"
            active-color="#181818"
            inactive-color="#999"
            :current="currentMainTab"
            @change="handleMainTabClick"
          />
        </view>

        <!-- 第二行：次级Tab切换栏 + 排序筛选 -->
        <view v-if="currentMainTab === 0" class="flex items-center px-32rpx py-16rpx">
          <scroll-view class="min-w-0 flex-1" scroll-x :show-scrollbar="false">
            <view class="flex items-center gap-16rpx">
              <template v-for="(tab, index) in categoryFilter.tabs.value" :key="index">
                <view
                  class="shrink-0 rounded-full px-24rpx py-16rpx transition-all duration-200"
                  :class="categoryFilter.currentTabIndex.value === index ? 'bg-primary text-white' : 'bg-[#F5F5F5] text-[#666]'"
                  @click="handleSubTabClick(index)"
                >
                  <text class="block text-28rpx leading-none">{{ tab.name }}</text>
                </view>
              </template>
            </view>
          </scroll-view>

          <!-- 排序筛选 -->
          <view class="relative ml-16rpx shrink-0">
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
      <view class="pointer-events-none sticky left-0 w-full" :style="{ height: '0', top: `${gradientMaskTop}px` }">
        <view class="w-full" :style="{ height: '80rpx', background: 'linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0))' }" />
      </view>

      <!-- 第三行：内容区域（min-height：100vh - 导航 - sticky - 底栏占位） -->
      <!-- 创作Tab -->
      <view v-if="currentMainTab === 0" class="flex-1 pb-[100rpx] pt-[16rpx]" :style="listSectionMinHeightStyle">
        <template v-if="waterfallData.length > 0">
          <FgWaterfall
            :list="waterfallData"
            :has-top-label="true"
            :has-type-label="true"
            :has-bottom-info="true"
            scene="2"
            @item-click="handleWaterfallItemClick"
            @asset-invalid="handleAssetInvalid"
            @all-images-loaded="isWaterfallImagesLoaded = true"
          />
          <!-- 底部提示：有数据、没有下一页、且图片全部加载完成时显示 -->
          <view v-if="!pageState.hasNext && !pageState.loading && isWaterfallImagesLoaded" class="py-40rpx text-center text-24rpx text-gray-400">
            - 到底了 -
          </view>
        </template>
        <fg-empty v-else-if="!pageState.loading" :full-height="false" />
      </view>
      <!-- 合集Tab -->
      <view v-else class="flex-1 pb-[100rpx]" :style="listSectionMinHeightStyle">
        <template v-if="collectionList.length > 0">
          <IpCollectionList
            :list="collectionList"
            :has-more="false"
            mode="collection"
            :show-password="true"
            :is-self="true"
            @edit-name="openEditName"
            @handle-click="toCollectionAssets"
          />
          <!-- 底部提示 -->
          <view class="py-40rpx text-center text-24rpx text-gray-400">
            - 到底了 -
          </view>
        </template>
        <fg-empty v-else :full-height="false" />
      </view>

      <!-- 创建/编辑合集弹窗 -->
      <CreateCollection
        v-model:visible="createCollectionVisible"
        :type="createCollectionType"
        :collection-name="editingCollectionName"
        :collection-id="editingCollectionId"
        @success="fetchCollectionList"
      />

      <view
        v-if="!(userInfo.level === 4 && currentMainTab === 1)"
        id="emp-footer"
        class="fixed bottom-0 left-0 z-[999] w-full flex items-center justify-between bg-white pb-40rpx pt-20rpx"
      >
        <view class="h-[60rpx] flex flex-1 items-center justify-center text-[32rpx] text-tip" @click="clickLeftBtn">
          <i v-if="currentMainTab === 0" class="iconfont icon-a-shuxingshangchuanzhuangtaioff text-[32rpx]" />
          <i v-else class="iconfont icon-a-shuxingxianxingmingchengtianjiazhuangtaion text-[32rpx]" />
          <text class="ml-8rpx">{{ currentMainTab === 1 ? '创建合集' : '上传作品' }}</text>
        </view>
        <view class="h-[60rpx] w-[2rpx] bg-[rgba(102,102,102,0.1)]" />
        <view class="h-[60rpx] flex flex-1 items-center justify-center text-[32rpx] text-[#666]" @click="clickRightBtn">
          <i class="iconfont icon-a-shuxingbianjizhuangtaioff text-[32rpx]" />
          <text class="ml-8rpx">编辑管理</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
</style>
