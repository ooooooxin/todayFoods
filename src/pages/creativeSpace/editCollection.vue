<script lang="ts" setup>
import type collectionPanel from '@/components/editor-management-panel/editor-collection-panel.vue'
import { onLoad, onPageScroll, onShow, onUnload } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { nextTick, ref, watchEffect } from 'vue'
import { deleteCollection, sortCollections } from '@/api/creativeSpace/creativeSpace'
import { getMyCollectionList } from '@/api/me/me'
import { showCustomToast } from '@/composables/useCustomToast'
import { usePageScrollBridge } from '@/hooks/usePageScrollBridge'
import { useCreativeSpaceStore } from '@/store/creativeSpace'
import { usePageScrollStore } from '@/store/pageScroll'
import { statusNavTotalHeight, systemInfo } from '@/utils/systemInfo'

const pageScrollStore = usePageScrollStore()
const { backToTopTrigger } = storeToRefs(pageScrollStore)
usePageScrollBridge()
const windowHeight = systemInfo.windowHeight || 800

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

// 页面加载时获取数据
onLoad(() => {
  fetchCollectionList()
})

interface CollectionItem {
  id: string
  name: string
  count: number
  bg: string
  images: string[]
  shareCode?: string
  selected: boolean
}

const creativeSpaceStore = useCreativeSpaceStore()

definePage({
  style: {
    navigationBarTitleText: '编辑管理',
  },
})

// 合集列表数据（本地ref，从store同步）
const collectionList = ref<CollectionItem[]>([])

// 组件引用
const collectionPanelRef = ref<InstanceType<typeof collectionPanel> | null>(null)

/** 与 editCollectionAssets 一致：拖拽时关闭外层 scroll-view 纵向滚动 */
const isDragging = ref(false)

function handleScroll(e: any) {
  pageScrollStore.setScrollTop(e.detail?.scrollTop || 0)
}

// 已选中的合集ID
const selectedIds = ref<string[]>([])

// 删除确认弹窗
const showDeleteConfirm = ref(false)
const deleteCount = ref(0)
const idsToDelete = ref<string[]>([])

onShow(() => {
  pageScrollStore.setToTopBottom(customToTopBottom.value)
  setTimeout(() => {
    if (uni.getStorageSync('needRefreshFromException') === '1') {
      uni.removeStorageSync('needRefreshFromException')
      fetchCollectionList()
    }
  }, 100)
})

// 监听store数据变化，同步到本地列表
watch(() => creativeSpaceStore.collectionList, (storeList) => {
  // 保留已选中状态
  const selectedIdSet = new Set(selectedIds.value)
  collectionList.value = storeList.map(item => ({
    ...item,
    selected: selectedIdSet.has(item.id),
  }))
}, { immediate: true, deep: true })

// 是否已经检查过是否可以滚动
let hasCheckedCanScroll = false

// 判断页面内容是否超出一页
function checkCanScroll() {
  // 避免重复检查
  if (hasCheckedCanScroll)
    return
  hasCheckedCanScroll = true

  // 延迟检查，确保 DOM 渲染完成
  setTimeout(() => {
    const query = uni.createSelectorQuery()
    query.select('.page-content').boundingClientRect((res: any) => {
      if (res && res.height > 0) {
        const scrollHeight = res.height
        const canScroll = scrollHeight > windowHeight
        console.log('canScroll', scrollHeight, windowHeight, canScroll)
        pageScrollStore.setCanScroll(canScroll)
      }
    }).exec()
  }, 100)
}

// 获取合集列表并更新store
async function fetchCollectionList() {
  try {
    const res = await getMyCollectionList()
    // 映射到组件要求的属性
    const list = (res?.records || []).map((item: any) => ({
      ...item,
      id: String(item.id),
      name: item.title,
      count: item.assetCount,
      countFormatted: item.assetCountFormatted,
      bg: item.coverUrl,
      images: item.topAssets?.map((a: any) => a.thumbUrl) || [],
    }))
    // 存储到store
    creativeSpaceStore.setCollectionList(list)
  }
  catch (error) {
    console.error('获取合集失败', error)
  }
  finally {
    // 数据加载完成后检查是否可以滚动
    await nextTick()
    checkCanScroll()
  }
}

// 处理排序变更
async function handleCollectionChanged(event: { action: string, selectedIds: Array<string | number>, changed: boolean, sortedList?: Array<{ id: string | number }>, draggedId?: string | number, previewIndex?: number }) {
  if (event.action === 'sort') {
    if (!event.sortedList || event.sortedList.length === 0) {
      return
    }

    try {
      await sortCollections({
        collections: event.sortedList.map(item => item.id as string),
      })
      console.log('合集排序成功')
      // 排序成功后更新 store 中的列表数据
      const sortedList = event.sortedList
      const sortedCollectionList = sortedList.map(item => collectionList.value.find(c => c.id === item.id)).filter(Boolean) as typeof collectionList.value
      creativeSpaceStore.setCollectionList(sortedCollectionList)
    }
    catch (error) {
      console.error('合集排序失败', error)
    }
  }
  if (event.action === 'remove') {
    // 触发素材列表刷新事件
    handleDelete(event.selectedIds)
  }
}

// 删除选中的合集
async function handleDelete(ids: Array<string | number>) {
  if (ids.length === 0) {
    showCustomToast({ title: '请选择要删除的合集', icon: 'none' })
    return
  }
  idsToDelete.value = ids as string[]
  deleteCount.value = ids.length
  showDeleteConfirm.value = true
}

// 确认删除
async function confirmDelete() {
  try {
    // 调用删除接口
    await deleteCollection({ ids: idsToDelete.value })

    // 删除成功后刷新列表
    await fetchCollectionList()

    // 清空子组件选中状态
    collectionPanelRef.value?.clearSelection()

    // 通知首页刷新合集列表数据
    uni.$emit('collectionListNeedRefresh')

    showCustomToast({ title: '删除成功', icon: 'success' })
  }
  catch (error) {
    console.error('删除合集失败', error)
    showCustomToast({ title: '删除失败', icon: 'none' })
  }
  finally {
    showDeleteConfirm.value = false
  }
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
  <!-- 与 editCollectionAssets 一致：固定视口高度 + 外层 scroll-view，拖拽时 :scroll-y="!isDragging" -->
  <view class="relative w-full overflow-hidden" :style="{ height: `${windowHeight}px` }">
    <!-- 头部占位 -->
    <CommonHeader mode="fixed" :scroll-top="0" bg-color="#ffffff" />
    <!-- 页面标题 -->
    <custom-title text="编辑管理" text-color="text-main" />

    <scroll-view
      id="edit-collection-scroll"
      ref="scrollViewRef"
      class="absolute left-0 top-0 w-full"
      :style="{ height: `${windowHeight}px` }"
      :scroll-top="scrollTopValue"
      :scroll-y="!isDragging"
      :show-scrollbar="false"
      :bounces="false"
      @scroll="handleScroll"
    >
      <!-- 有数据时显示列表 -->
      <view
        v-if="collectionList.length > 0"
        class="page-content box-border w-full pt-24rpx"
        :style="{ paddingTop: `${statusNavTotalHeight}px` }"
      >
        <editor-collection-panel
          ref="collectionPanelRef"
          :items="collectionList"
          hide-internal-footer
          @changed="handleCollectionChanged"
          @drag-state-change="isDragging = $event"
        />
      </view>
      <!-- 无数据时显示空状态 -->
      <fg-empty v-else class="flex-1" />
    </scroll-view>

    <!--
      footer 必须放在 <scroll-view> 之外：
      微信小程序中 scroll-view 是原生组件,其内部 position: fixed 会被约束在 scroll-view
      渲染层内导致不显示 / 被遮挡。放到页面根下即可正常吸底。
    -->
    <view
      v-if="collectionList.length > 0"
      id="collection-footer"
      class="fixed bottom-0 left-0 z-[999] w-full flex items-center justify-center bg-white pb-40rpx pt-20rpx"
    >
      <view
        class="h-88rpx w-full center rounded-full bg-[#fff]"
        @tap.stop="collectionPanelRef?.handleRemove()"
      >
        <text class="text-32rpx text-error font-bold">
          删除
        </text>
      </view>
    </view>

    <!-- 删除确认弹窗 -->
    <ConfirmPopup
      v-model:visible="showDeleteConfirm"
      title="删除合集"
      :message="`确认删除选中的${deleteCount}个合集吗？`"
      cancel-text="取消"
      confirm-text="确认删除"
      @confirm="confirmDelete"
    />
  </view>
</template>

<style scoped lang="scss"></style>
