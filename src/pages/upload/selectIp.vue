<script lang="ts" setup>
import type { GetOnShelfIpPageParams, OnShelfIpItem } from '@/api/ip/ip'
import { onReachBottom } from '@dcloudio/uni-app'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { getOnShelfIpPage } from '@/api/ip/ip'
import { showCustomToast } from '@/composables/useCustomToast'
import { useUploadStore } from '@/store'
import { getSearchKeywordParam } from '@/utils'
import { statusNavTotalHeight } from '@/utils/systemInfo'

const uploadStore = useUploadStore()

// 直接使用 store 的方法
const { setSelectedIp, setFromSelectIp } = uploadStore

definePage({
  style: {
    navigationBarTitleText: '选择关联IP',
  },
})

// 搜索文本
const keyWord = ref('')

// IP列表数据
const ipList = ref<OnShelfIpItem[]>([])

// 加载状态
const isLoading = ref(false)
const hasMore = ref(true)

// 分页参数
const pageNum = ref(1)
const pageSize = 20

/**
 * 切换IP选中状态
 * @param item IP 对象
 */
const toggleIpSelection = (item: OnShelfIpItem) => {
  if (uploadStore.selectedIp?.id === item.id) {
    setSelectedIp(null)
  }
  else {
    setSelectedIp(item)
    uni.navigateBack()
  }
}

/**
 * 获取IP列表数据
 * @param isLoadMore 是否是加载更多
 */
const fetchIpList = async (isLoadMore = false) => {
  if (isLoading.value)
    return

  isLoading.value = true

  try {
    if (!isLoadMore) {
      pageNum.value = 1
    }

    const params: GetOnShelfIpPageParams = {
      pageNum: pageNum.value,
      pageSize,
      ipName: getSearchKeywordParam(keyWord.value),
      // ...(userInfo.value.level === 4 && userInfo.value.seriesId ? { seriesId: userInfo.value.seriesId } : {}),
    }

    const res = await getOnShelfIpPage(params)

    if (isLoadMore) {
      ipList.value.push(...res.records)
    }
    else {
      ipList.value = res.records
    }

    hasMore.value = res.records.length === pageSize && res.records.length > 0
    if (hasMore.value) {
      pageNum.value++
    }
  }
  catch (error) {
    console.error('获取IP列表失败:', error)
    showCustomToast({ title: '获取数据失败', icon: 'none' })
  }
  finally {
    isLoading.value = false
  }
}

// 搜索防抖计时器
let searchTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 搜索功能
 */
const onSearch = () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  pageNum.value = 1
  hasMore.value = true
  fetchIpList(false)
}

// 监听搜索输入变化，防抖搜索
watch(keyWord, () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(() => {
    pageNum.value = 1
    hasMore.value = true
    ipList.value = []
    fetchIpList(false)
  }, 300)
})

// 加载更多锁，防止重复触发
let loadMoreLock = false

/**
 * 加载更多
 */
const onLoadMore = () => {
  if (!hasMore.value || isLoading.value || loadMoreLock)
    return

  loadMoreLock = true
  fetchIpList(true)

  // 300ms 后解锁
  setTimeout(() => {
    loadMoreLock = false
  }, 300)
}

/**
 * 点击IP项
 */
const onIpClick = (item: OnShelfIpItem) => {
  toggleIpSelection(item)
}

/**
 * 获取默认图片
 */
const getDefaultImage = () => {
  return '/static/images/ic_default_ip.png'
}

onMounted(() => {
  fetchIpList()
})

// 页面卸载（返回上一页）时设置标记
onUnmounted(() => {
  console.log('selectIp onUnmounted 触发', {
    selectedIp: uploadStore.selectedIp,
  })
  if (uploadStore.selectedIp) {
    setFromSelectIp(true)
    console.log('已设置 fromSelectIp 为 true')
  }
})

// 页面触底加载更多
onReachBottom(() => {
  onLoadMore()
})
</script>

<template>
  <view class="h-screen flex flex-col bg-white">
    <CommonHeader mode="fixed" :scroll-top="0" bg-color="#FFFFFF" />
    <custom-title text="选择关联IP" text-color="text-main" />

    <!-- 搜索栏 -->
    <view
      class="fixed left-0 right-0 z-10 center bg-white pa-20rpx"
      :style="{ top: `${statusNavTotalHeight}px` }"
    >
      <view class="h-80rpx w-full flex items-center rounded-45rpx bg-[#F5F5F5]">
        <image
          src="/src/static/images/ic_search.png"
          mode="scaleToFill"
          class="ml-[24rpx] h-40rpx w-40rpx"
        />
        <input
          v-model="keyWord"
          class="h-full flex-1 pl-[20rpx] pr-[12rpx] text-28rpx text-main"
          type="text"
          placeholder="请输入IP名称"
          placeholder-style="color:#999;font-size:28rpx;"
          @confirm="onSearch"
        >
        <view
          v-if="keyWord"
          class="mr-[12rpx] h-48rpx w-48rpx flex items-center justify-center"
          @click="keyWord = ''"
        >
          <image
            src="/static/images/ic_clear.png"
            class="h-32rpx w-32rpx"
          />
        </view>
        <view
          class="mr-[24rpx] border-l-[2rpx] border-l-[rgba(102,102,102,0.1)] border-solid b-b-none b-r-none b-t-none pl-24rpx text-28rpx text-main font-bold"
          @click="onSearch"
        >
          搜索
        </view>
      </view>
    </view>

    <!-- 有数据时显示IP列表 -->
    <view
      v-if="ipList.length > 0"
      class="box-border flex-1 px-20rpx pb-20rpx"
      :style="{ paddingTop: `${statusNavTotalHeight + 68}px` }"
    >
      <view class="grid grid-cols-3 gap-16rpx">
        <view
          v-for="item in ipList"
          :key="item.id"
          class="relative h-[310rpx] flex flex-col overflow-hidden rounded-16rpx bg-[#F5F5F5]"
          @click="onIpClick(item)"
        >
          <!-- IP图片 -->
          <image
            :src="item.desImgUrl || item.avatarImgUrl || getDefaultImage()"
            mode="aspectFill"
            class="h-full w-full"
          />

          <!-- 底部渐变和名称 -->
          <view class="absolute bottom-0 left-0 box-border h-[100rpx] w-full flex items-end bg-[linear-gradient(0deg,rgba(24,24,24,1)0%,rgba(24,24,24,0)100%)] p-[12rpx]">
            <view class="truncate text-24rpx text-white font-bold">
              {{ item.name }}
            </view>
          </view>

          <!-- 选中状态 -->
          <view
            v-if="uploadStore.selectedIp?.id === item.id"
            class="absolute right-12rpx top-12rpx h-36rpx w-36rpx"
          >
            <image
              src="/src/static/images/ic_checkbox_on.png"
              mode="scaleToFill"
              class="h-full w-full"
            />
          </view>

          <!-- 未选中状态 -->
          <view
            v-else
            class="absolute right-12rpx top-12rpx h-36rpx w-36rpx"
          >
            <image
              src="/src/static/images/ic_checkbox_off.png"
              mode="scaleToFill"
              class="h-full w-full"
            />
          </view>
        </view>
      </view>

      <!-- 底部提示：有数据、没有下一页、且不在加载中时显示 -->
      <view v-if="!hasMore && !isLoading" class="py-40rpx text-center text-24rpx text-gray-400">
        - 到底了 -
      </view>
    </view>

    <!-- 无数据时显示空状态 -->
    <fg-empty v-if="ipList.length === 0 && !isLoading" type="content" class="flex-1" />
  </view>
</template>

<style scoped lang="scss"></style>
