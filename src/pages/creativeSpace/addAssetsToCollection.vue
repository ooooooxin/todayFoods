<script lang="ts" setup>
import type { MyAssetItem } from '@/api/me/me'
import { onLoad, onPageScroll, onReachBottom, onShow } from '@dcloudio/uni-app'
import { reactive, ref } from 'vue'
import { addAssetsToCollection } from '@/api/creativeSpace/creativeSpace'
import { getMyAssetList } from '@/api/me/me'
import { showCustomToast } from '@/composables/useCustomToast'
import { usePageScrollBridge } from '@/hooks/usePageScrollBridge'
import { usePageScrollStore } from '@/store/pageScroll'
import { statusNavTotalHeight } from '@/utils/systemInfo'

const pageScrollStore = usePageScrollStore()
usePageScrollBridge()

const customToTopBottom = ref('192rpx')

// 页面参数
const collectionId = ref<number | string>()

// 当前选中的分类 ID
const currentCategoryId = ref<string>('')
// 当前选中的二级分类 ID（对应 fileType：0-全部、1-图片、2-GIF、3-视频）
const currentFileType = ref<string>('')

onLoad((options) => {
  collectionId.value = options?.collectionId || undefined
  // 初始加载数据
  fetchAssetList(true)
})

definePage({
  style: {
    navigationBarTitleText: '添加作品',
  },
})

// 素材列表数据
const assetList = ref<MyAssetItem[]>([])

// 分页状态
const pageState = reactive({
  nextCursorId: undefined as number | undefined,
  nextCursorIsTop: undefined as number | undefined,
  nextCursorScore: undefined as number | undefined,
  hasNext: true,
  loading: false,
})

onShow(() => {
  pageScrollStore.setToTopBottom(customToTopBottom.value)
  setTimeout(() => {
    if (uni.getStorageSync('needRefreshFromException') === '1') {
      uni.removeStorageSync('needRefreshFromException')
      fetchAssetList(true)
    }
  }, 100)
})

onPageScroll((e: any) => {
  pageScrollStore.setScrollTop(e.scrollTop || 0)
})

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
  try {
    const res = await getMyAssetList({
      pageSize: 30,
      cursorId: pageState.nextCursorId,
      sortOrder: pageState.nextCursorScore,
      cursorIsTop: pageState.nextCursorIsTop,
      category: currentCategoryId.value ? Number(currentCategoryId.value) : undefined,
      fileType: currentFileType.value ? Number(currentFileType.value) : undefined,
      excludeCollectionId: collectionId.value,
    })

    if (isRefresh) {
      assetList.value = res.records
    }
    else {
      assetList.value = [...assetList.value, ...res.records]
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

// 处理 Tab 切换
const handleTabChange = (tabId: string, subTabId = '') => {
  currentCategoryId.value = tabId
  currentFileType.value = subTabId
  uni.pageScrollTo({ scrollTop: 0 })
  // 切换分类时刷新列表
  fetchAssetList(true)
}

// 处理二级 Tab 切换
const handleSubTabChange = (subTabId: string) => {
  currentFileType.value = subTabId
  uni.pageScrollTo({ scrollTop: 0 })
  // 切换二级分类时刷新列表
  fetchAssetList(true)
}

// 处理素材操作
const handleChanged = async (event: { action: string, selectedIds: Array<string | number>, changed: boolean }) => {
  if (event.action === 'add') {
    // 确认添加素材
    if (!collectionId.value) {
      showCustomToast({ title: '合集ID不存在', icon: 'none' })
      return
    }
    if (event.selectedIds.length === 0) {
      showCustomToast({ title: '请选择要添加的素材', icon: 'none' })
      return
    }

    try {
      uni.showLoading({ title: '添加中...' })
      await addAssetsToCollection({
        collectionId: collectionId.value,
        assetIds: event.selectedIds.map(id => id),
      })
      uni.hideLoading()
      showCustomToast({ title: '添加成功', icon: 'success' })
      // 添加成功后返回上一页，并通知上一页刷新
      uni.$emit('collectionAssetsUpdated', { collectionId: collectionId.value })
      setTimeout(() => {
        uni.navigateBack()
      }, 1500)
    }
    catch (error) {
      uni.hideLoading()
      console.error('添加素材失败', error)
      showCustomToast({ title: '添加失败', icon: 'none' })
    }
  }
}

// 页面触底加载更多
onReachBottom(() => {
  fetchAssetList()
})
</script>

<template>
  <view>
    <!-- 头部占位 -->
    <CommonHeader mode="fixed" :scroll-top="0" bg-color="#ffffff" />
    <!-- 页面标题 -->
    <custom-title text="添加作品" text-color="text-main" />
    <view :style="{ paddingTop: `${statusNavTotalHeight}px` }">
      <editor-assets-panel
        mode="add" :items="assetList"
        @tab-change="handleTabChange"
        @sub-tab-change="handleSubTabChange"
        @changed="handleChanged"
      />
    </view>
  </view>
</template>

<style scoped lang="scss"></style>
