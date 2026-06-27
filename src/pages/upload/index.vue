<script lang="ts" setup>
import type { OnShelfIpItem } from '@/api/ip/ip'
import type { MaterialType } from '@/store'
import { onShow } from '@dcloudio/uni-app'
import { computed, ref, watch } from 'vue'
import { getAuditStatistics } from '@/api/auditCenter/auditCenter'
import { checkIpOnShelf } from '@/api/common'
import { getOnShelfIpPage } from '@/api/ip/ip'
import { getMyAssetList } from '@/api/me/me'
import { showCustomToast } from '@/composables/useCustomToast'
import { useSystemConfig } from '@/composables/useSystemConfig'
import { useUploadStore } from '@/store'
import { useUserStore } from '@/store/user'
import { getSearchKeywordParam } from '@/utils'
import { formatFileSize } from '@/utils/materialValidator'

definePage({
  style: {
    navigationBarTitleText: '上传作品',
  },
})

const uploadStore = useUploadStore()
const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)
const { modelList } = uploadStore
const { navToAgreement } = useSystemConfig()

// 是否同意协议（从缓存读取）
const isAgreed = ref(uni.getStorageSync('upload_agreement_agreed') || false)

// 表情上传类型弹窗
const showExpressionTypePopup = ref(false)

// 防止相册 API 频繁调用的锁
const isChoosingMedia = ref(false)

// ========== IP 选择弹窗相关 ==========
const showIpSelectPopup = ref(false)
const ipSearchKeyword = ref('')
const ipList = ref<OnShelfIpItem[]>([])
const ipLoading = ref(false)
const ipHasMore = ref(true)
const ipPageNum = ref(1)
const ipPageSize = 20
const selectedIp = ref<OnShelfIpItem | null>(null)

async function fetchIpList(isLoadMore = false) {
  if (ipLoading.value)
    return
  ipLoading.value = true
  try {
    if (!isLoadMore) {
      ipPageNum.value = 1
    }
    const params = {
      pageNum: ipPageNum.value,
      pageSize: ipPageSize,
      ipName: getSearchKeywordParam(ipSearchKeyword.value),
    }
    const res = await getOnShelfIpPage(params)
    if (isLoadMore) {
      ipList.value.push(...res.records)
    }
    else {
      ipList.value = res.records
    }
    ipHasMore.value = res.records.length === ipPageSize && res.records.length > 0
    if (ipHasMore.value) {
      ipPageNum.value++
    }
  }
  catch (error) {
    console.error('获取IP列表失败:', error)
    showCustomToast({ title: '获取数据失败', icon: 'none' })
  }
  finally {
    ipLoading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null

function onIpSearch() {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  ipPageNum.value = 1
  ipHasMore.value = true
  fetchIpList(false)
}

watch(ipSearchKeyword, () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(() => {
    ipPageNum.value = 1
    ipHasMore.value = true
    ipList.value = []
    fetchIpList(false)
  }, 300)
})

function toggleIpSelection(item: OnShelfIpItem) {
  if (selectedIp.value?.id === item.id) {
    selectedIp.value = null
    uploadStore.setSelectedIp(null)
  }
  else {
    selectedIp.value = item
    uploadStore.setSelectedIp(item)
    showIpSelectPopup.value = false
  }
}

function getDefaultIpImage() {
  return '/static/images/ic_default_ip.png'
}

function openIpSelectPopup() {
  showIpSelectPopup.value = true
  if (ipList.value.length === 0) {
    fetchIpList()
  }
}

// 触底加载更多
function onIpReachBottom() {
  if (!ipHasMore.value || ipLoading.value)
    return
  fetchIpList(true)
}

/**
 * 获取审核统计并计算可选素材数量
 * @returns 是否允许继续选择，以及可选数量
 */
async function checkAuditStatistics(): Promise<{ canSelect: boolean, count: number }> {
  try {
    const [auditRes, assetRes] = await Promise.all([
      getAuditStatistics(),
      getMyAssetList({ pageSize: 1 }),
    ])
    const total = (auditRes.auditingNum || 0) + (Number(assetRes.total || 0))

    const maxLimit = 9999

    if (total >= maxLimit) {
      showCustomToast({ title: `作品数量已达${maxLimit}上限，请删除部分作品后再上传`, icon: 'none' })
      return { canSelect: false, count: 0 }
    }

    const remaining = maxLimit - total
    const maxSelectable = 9
    const count = Math.min(remaining, maxSelectable)

    return { canSelect: count > 0, count }
  }
  catch (error) {
    console.error('获取审核统计失败:', error)
    // 接口失败时默认允许选择9个
    return { canSelect: true, count: 9 }
  }
}

/** 选择表情-图片/GIF 上传 */
async function selectExpressionImage() {
  if (isChoosingMedia.value)
    return

  const { canSelect, count } = await checkAuditStatistics()
  if (!canSelect) {
    isChoosingMedia.value = false
    return
  }

  isChoosingMedia.value = true
  showExpressionTypePopup.value = false
  uni.chooseImage({
    count,
    sizeType: ['original'],
    sourceType: ['album'],
    success: async (res) => {
      const tempFilePaths = res.tempFilePaths as string[]
      const tempFilesRaw = res.tempFiles || tempFilePaths.map((path: string) => ({
        path,
        size: 0,
      }))
      const tempFiles = Array.isArray(tempFilesRaw) ? tempFilesRaw : [tempFilesRaw]
      if (tempFiles.length === 0) {
        isChoosingMedia.value = false
        return
      }

      const fileData = await Promise.all(
        tempFiles.map(async (file: any, index: number) => {
          const filePath = file.path || file
          let isGif = filePath.toLowerCase().endsWith('.gif')
          let width = 0
          let height = 0

          try {
            const imageInfo = await uni.getImageInfo({ src: filePath })
            isGif = imageInfo.type?.toLowerCase() === 'gif'
            width = imageInfo.width
            height = imageInfo.height
          }
          catch (err) {
            console.log('getImageInfo failed:', err)
          }

          const fileType = isGif ? 'gif' : 'image'
          const name = isGif ? 'GIF' : '图片'

          return {
            id: `${Date.now()}-${index}`,
            type: fileType as MaterialType,
            name,
            path: filePath,
            thumbnail: filePath,
            size: formatFileSize(file.size || 0),
            progress: 0,
            status: 'uploading' as const,
            width,
            height,
          }
        }),
      )

      uploadStore.clearMaterials()
      uploadStore.setCurrentType(1)
      uploadStore.addMaterials(fileData)
      uni.navigateTo({
        url: '/pages/upload/uploadProcess?type=1',
      })
    },
    fail: () => {
      console.log('fail')
      isChoosingMedia.value = false
    },
  })
}

/** 选择表情-视频上传 */
async function selectExpressionVideo() {
  if (isChoosingMedia.value)
    return

  const { canSelect, count } = await checkAuditStatistics()
  if (!canSelect) {
    isChoosingMedia.value = false
    return
  }

  isChoosingMedia.value = true
  showExpressionTypePopup.value = false
  uni.chooseMedia({
    count,
    mediaType: ['video'],
    sourceType: ['album'],
    sizeType: ['original'],
    success: (res) => {
      const tempFiles = res.tempFiles
      if (tempFiles.length === 0) {
        isChoosingMedia.value = false
        return
      }

      const fileData = tempFiles.map((file: any, index: number) => ({
        id: `${Date.now()}-${index}`,
        type: 'video' as MaterialType,
        name: '视频',
        path: file.tempFilePath,
        thumbnail: file.thumbTempFilePath || file.tempFilePath,
        size: formatFileSize(file.size),
        progress: 0,
        status: 'uploading' as const,
        width: file.width,
        height: file.height,
        // 微信 chooseMedia 返回的 duration 单位为秒（非毫秒），勿再 /1000
        duration: file.duration != null && file.duration > 0 ? Math.round(file.duration) : undefined,
      }))

      uploadStore.clearMaterials()
      uploadStore.setCurrentType(1)
      uploadStore.addMaterials(fileData)
      uni.navigateTo({
        url: '/pages/upload/uploadProcess?type=1',
      })
    },
    fail: () => {
      console.log('fail')
      isChoosingMedia.value = false
    },
  })
}

// 切换协议同意状态
function toggleAgreement() {
  isAgreed.value = !isAgreed.value
  uni.setStorageSync('upload_agreement_agreed', isAgreed.value)
}

// 页面显示时重置相册调用锁
onShow(() => {
  isChoosingMedia.value = false
  selectedIp.value = uploadStore.selectedIp || null
})

async function canSelect() {
  if (userInfo.value.level === 4 && !selectedIp.value) {
    showCustomToast({ title: '请先选择IP', icon: 'none' })
    return false
  }

  // 检查IP是否上架
  if (selectedIp.value) {
    try {
      await checkIpOnShelf({ ipId: selectedIp.value.id })
    }
    catch (error: any) {
      // code = 4005 表示IP暂不可访问
      if (error?.code === 4005) {
        showCustomToast({ title: '关联IP已经下架，请重新选择', icon: 'none' })
        selectedIp.value = null
        return false
      }
    }
  }

  if (!isAgreed.value && userInfo.value.level !== 4) {
    showCustomToast({ title: '请先阅读并同意《创作者服务协议》', icon: 'none' })
    return false
  }
  return true
}

async function openExpressionTypePopup() {
  if (!await canSelect())
    return

  showExpressionTypePopup.value = true
}

/**
 * 选择素材（头像/背景/壁纸，表情由弹窗选择后走 selectExpressionImage/selectExpressionVideo）
 * @param type 素材类型 2：头像 3：背景 4：壁纸
 */
async function selectAssets(type: number) {
  if (isChoosingMedia.value)
    return
  if (!await canSelect())
    return

  const { canSelect: canSelectByAudit, count } = await checkAuditStatistics()
  if (!canSelectByAudit) {
    isChoosingMedia.value = false
    return
  }

  isChoosingMedia.value = true
  const mediaType: ('image' | 'video' | 'mix')[] = type === 2 ? ['image'] : ['image', 'video']
  uni.chooseMedia({
    count,
    mediaType,
    sourceType: ['album'],
    sizeType: ['original'],
    success: async (res) => {
      const tempFiles = res.tempFiles
      if (tempFiles.length === 0) {
        isChoosingMedia.value = false
        return
      }

      const fileData = await Promise.all(
        tempFiles.map(async (file: any, index: number) => {
          const isVideo = /\.(?:mp4|mov|avi|mkv|webm)$/i.test(file.tempFilePath)
          let isGif = file.tempFilePath.toLowerCase().endsWith('.gif')

          if (!isVideo) {
            try {
              const imageInfo = await uni.getImageInfo({ src: file.tempFilePath })
              isGif = imageInfo.type?.toLowerCase() === 'gif'
            }
            catch (err) {
              console.log('getImageInfo failed:', err)
            }
          }

          const fileType = isVideo ? 'video' : (isGif ? 'gif' : 'image')
          const name = isVideo ? '视频' : (isGif ? 'GIF' : '图片')

          return {
            id: `${Date.now()}-${index}`,
            type: fileType as MaterialType,
            name,
            path: file.tempFilePath,
            thumbnail: file.thumbTempFilePath || file.tempFilePath,
            size: formatFileSize(file.size),
            progress: 0,
            status: 'uploading' as const,
            width: file.width,
            height: file.height,
            duration: file.duration != null && file.duration > 0 ? Math.round(file.duration) : undefined,
          }
        }),
      )

      uploadStore.clearMaterials()
      uploadStore.setCurrentType(type)
      uploadStore.addMaterials(fileData)
      uni.navigateTo({
        url: `/pages/upload/uploadProcess?type=${type}`,
      })
    },
    fail: () => {
      console.log('fail')
      isChoosingMedia.value = false
    },
  })
}

// 选择IP - 打开弹窗
function toSelectIP() {
  openIpSelectPopup()
}
</script>

<template>
  <view class="relative min-h-screen px-32rpx pb-safe">
    <CommonHeader mode="auto" :scroll-top="0" />
    <custom-title text="上传作品" text-color="text-main" />

    <!-- 标题区域 -->
    <!-- <view class="relative mt-40rpx flex flex-col items-start">
      <image class="z-10 h-70rpx w-240rpx" src="/static/images/upload_text.png" mode="aspectFit" />
      <image class="h-24rpx w-250rpx -mt-16rpx" src="/static/images/line.png" mode="widthFix" />
    </view> -->

    <view class="relative mt-76rpx w-full center rounded-24rpx bg-[#FFF] px-32rpx" :class="userInfo.level !== 4 ? 'h-232rpx' : 'h-192rpx'">
      <!-- 已选中IP时显示 -->
      <view
        v-if="selectedIp"
        class="relative w-full rounded-24rpx bg-[#F5F5F5] py-28rpx pl-30rpx"
        @click="toSelectIP"
      >
        <image
          :src="selectedIp.mainImgUrl || selectedIp.avatarImgUrl || '/static/images/ic_default_ip.png'"
          class="absolute bottom-0 right-20rpx h-208rpx w-138rpx"
          mode="aspectFill"
        />
        <text class="text-32rpx text-main font-bold">
          {{ selectedIp.name }}
        </text>
      </view>
      <!-- 未选中IP时显示 -->
      <view
        v-else
        class="w-full rounded-24rpx bg-primary py-28rpx text-center text-32rpx text-[#fff] font-bold"
        :class="{ 'mt-20rpx': userInfo.level === 4 }"
        @click="toSelectIP"
      >
        <text>请选择关联IP</text>
      </view>
      <view v-if="userInfo.level !== 4" class="absolute bottom-16rpx left-0 w-full text-center">
        <text class="text-[24rpx] text-[#666666] line-height-40rpx">上传前请先选择关联IP，未选择将默认不关联</text>
      </view>

      <image class="absolute left-32rpx top-[-24rpx] h-76rpx w-192rpx" src="/static/images/upload_text.png" mode="widthFix" />
    </view>

    <!-- 作品类型区域 -->
    <view class="relative mt-48rpx w-full">
      <!-- 第一行：标题 -->
      <view class="flex items-center justify-between">
        <text class="text-32rpx text-main font-bold">请选择作品类型</text>
      </view>

      <!-- 第二行：四个模块 -->
      <view class="mt-32rpx flex flex-col">
        <view v-for="item in modelList" :key="item.type" class="mb-24rpx box-border h-140rpx w-full flex items-center justify-between rounded-32rpx bg-[#FFF] px-30rpx" @click="item.type === 1 ? openExpressionTypePopup() : selectAssets(item.type)">
          <view class="flex flex-col">
            <text class="text-32rpx text-main font-bold line-height-48rpx">{{ item.name }}</text>
            <text class="mt-8rpx text-24rpx text-[#666] line-height-40rpx">{{ item.tips }}</text>
          </view>
          <view class="h-92rpx w-92rpx center rounded-full bg-[#F5F5F5]">
            <image class="h-48rpx w-48rpx" :src="item.img" mode="aspectFit" />
          </view>
        </view>
      </view>

      <!-- 第三行：提示文字 -->
      <view class="w-full text-center">
        <text class="text-24rpx text-[#666] line-height-40rpx">注:单次上传最多支持9个(图片/GIF/视频)</text>
      </view>
    </view>

    <!-- 协议区域 -->
    <view v-if="userInfo.level !== 4" class="mt-40rpx w-full flex flex-col items-center">
      <view class="flex flex-wrap items-center justify-center" @click="toggleAgreement">
        <view class="relative ml-10rpx h-36rpx w-36rpx">
          <image
            v-if="isAgreed"
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
        <text class="text-24rpx text-[#666] line-height-40rpx">我已阅读并遵守</text>
        <text class="text-24rpx text-main font-bold" @click.stop="navToAgreement('creator')">《创作者服务协议》</text>
      </view>
      <text class="mt-16rpx text-center text-24rpx text-[#999] line-height-40rpx">非平台IP二创作品需承诺所上传的作品</text>
      <text class="text-center text-24rpx text-[#999] line-height-40rpx">均属原创或已取得相关授权</text>
    </view>

    <!-- 选择表情上传类型弹窗 -->
    <u-popup
      v-model="showExpressionTypePopup"
      mode="bottom"
      :zoom="false"
      :mask-close-able="true"
      :closeable="false"
      border-radius="24"
      :show-height="580"
    >
      <view class="flex flex-col bg-[#f5f5f5]">
        <!-- 标题 -->
        <view class="h-96rpx center px-32rpx">
          <text class="text-32rpx text-[#181818] font-bold">选择表情上传类型</text>
        </view>
        <!-- 两个选项卡片 -->
        <view class="flex gap-24rpx px-32rpx pb-48rpx">
          <!-- 图片/GIF 上传 -->
          <view class="box-border h-[380rpx] w-[328rpx] flex flex-1 flex-col items-center rounded-24rpx bg-[#fff] px-56rpx py-40rpx" @click="selectExpressionImage">
            <image class="mb-16rpx h-120rpx w-120rpx" src="/static/images/ic_upload_picture.png" mode="aspectFit" />
            <text class="text-center text-24rpx text-[#666] line-height-40rpx">支持选择手机相册中图片/GIF</text>
            <view
              class="mt-30rpx h-60rpx w-160rpx flex items-center justify-center rounded-full bg-[#f5f5f5]"
            >
              <text class="text-28rpx text-[#333] font-medium">上传图片</text>
            </view>
          </view>
          <!-- 视频上传 -->
          <view class="box-border h-[380rpx] w-[328rpx] flex flex-1 flex-col items-center rounded-24rpx bg-[#fff] px-56rpx py-40rpx" @click="selectExpressionVideo">
            <image class="mb-16rpx h-120rpx w-120rpx" src="/static/images/ic_upload_video.png" mode="aspectFit" />
            <text class="text-center text-24rpx text-[#666] line-height-40rpx">仅支持选择</text>
            <text class="text-center text-24rpx text-[#666] line-height-40rpx">视频文件</text>
            <view
              class="mt-30rpx h-60rpx w-160rpx flex items-center justify-center rounded-full bg-[#f5f5f5]"
            >
              <text class="text-28rpx text-[#333] font-medium">上传视频</text>
            </view>
          </view>
        </view>
      </view>
    </u-popup>

    <!-- IP 选择弹窗 -->
    <u-popup
      v-model="showIpSelectPopup"
      mode="bottom"
      :zoom="false"
      :mask-close-able="true"
      :closeable="false"
      border-radius="32"
      height="80%"
    >
      <view class="flex flex-col items-center bg-[#F5F5F5]">
        <!-- 搜索栏 -->
        <view class="mt-56rpx h-84rpx w-686rpx flex items-center rounded-45rpx bg-white px-32rpx">
          <image
            src="/static/images/ic_search.png"
            mode="scaleToFill"
            class="h-40rpx w-40rpx"
          />
          <view class="h-full flex flex-1 items-center">
            <input
              v-model="ipSearchKeyword"
              class="h-full flex-1 pl-20rpx pr-12rpx text-28rpx text-main"
              type="text"
              placeholder="请输入IP名称"
              placeholder-class="text-[#999]"
              @confirm="onIpSearch"
            >
            <view
              v-if="ipSearchKeyword"
              class="mr-12rpx h-48rpx w-48rpx flex items-center justify-center"
              @click="ipSearchKeyword = ''"
            >
              <image
                src="/static/images/ic_clear.png"
                class="h-32rpx w-32rpx"
              />
            </view>
          </view>
          <view
            class="border-l-[2rpx] border-l-[rgba(102,102,102,0.1)] border-solid b-b-none b-r-none b-t-none pl-24rpx text-28rpx text-main font-bold"
            @click="onIpSearch"
          >
            搜索
          </view>
        </view>

        <!-- IP 列表 -->
        <scroll-view
          scroll-y
          class="mt-32rpx px-20rpx pb-20rpx"
          style="height: calc(80vh - 200rpx)"
          @reach-bottom="onIpReachBottom"
        >
          <view class="flex flex-col items-center gap-16rpx">
            <view
              v-for="item in ipList"
              :key="item.id"
              class="relative w-686rpx flex items-center border-2 rounded-24rpx border-solid bg-white p-24rpx"
              :class="selectedIp?.id === item.id ? 'border-[#181818]' : 'border-transparent'"
              @click="toggleIpSelection(item)"
            >
              <image
                :src="item.avatarImgUrl || item.desImgUrl || getDefaultIpImage()"
                mode="aspectFill"
                class="h-100rpx w-100rpx rounded-8rpx"
              />
              <view class="ml-24rpx flex flex-1 flex-col">
                <text class="text-32rpx text-main font-bold">{{ item.name }}</text>
                <text class="mt-16rpx text-24rpx text-[#999]">{{ item.seriesName || '' }}111</text>
              </view>
              <image
                v-if="selectedIp?.id === item.id"
                src="/static/images/ip_checkbox.png"
                mode="scaleToFill"
                class="absolute right-[-2rpx] top-[-2rpx] h-48rpx w-48rpx"
              />
            </view>
          </view>

          <!-- 加载状态 -->
          <view v-if="ipLoading" class="py-40rpx text-center text-24rpx text-gray-400">
            加载中...
          </view>
          <view v-if="!ipHasMore && ipList.length > 0" class="py-40rpx text-center text-24rpx text-gray-400">
            - 到底了 -
          </view>
          <!-- 无数据时显示空状态 -->
          <fg-empty v-if="ipList.length === 0 && !ipLoading" class="flex-1" />
        </scroll-view>
      </view>
    </u-popup>
  </view>
</template>

<style scoped lang="scss"></style>
