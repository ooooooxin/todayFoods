<script lang="ts" setup>
import type { IStsTokenRes } from '@/api/upload/upload'
import { onLoad } from '@dcloudio/uni-app'
import { computed, onUnmounted, ref } from 'vue'
import { deleteCheckTokens, getStsToken, preCheck, publish } from '@/api/upload/upload'
import { showCustomToast } from '@/composables/useCustomToast'
import { useUploadStore } from '@/store'
import { validateMaterials } from '@/utils/materialValidator'
import { generateUploadPath, uploadFileToOss } from '@/utils/ossUpload'
import { statusNavTotalHeight, systemInfo } from '@/utils/systemInfo'

definePage({
  style: {
    navigationBarTitleText: '上传作品',
  },
})

const uploadStore = useUploadStore()
const { materialList, modelList, selectedIp, clearSelectedIpState } = uploadStore
// isButtonActive 是 computed，需要使用 storeToRefs 或直接从 store 访问
const isButtonActive = computed(() => uploadStore.isButtonActive)

const typeInfo = computed(() => {
  return modelList.find((m: any) => m.type === uploadStore.currentType)
})

const swipeState = ref<{
  currentId: string | null
  startX: number
}>({
  currentId: null,
  startX: 0,
})

// 存储每个素材上传后的 token
const materialTokens = ref<Map<string, string>>(new Map())

const statusTextMap = {
  uploading: '上传中',
  failed: '上传失败',
  completed: '已完成',
}

const statusColorMap = {
  uploading: 'text-tip',
  failed: 'text-error',
  completed: 'text-success',
}

/**
 * 上传单个素材
 */
async function uploadMaterial(item: any, stsToken: IStsTokenRes) {
  if (item.status !== 'uploading')
    return

  try {
    // 生成上传路径（传入 filePath 用于提取扩展名）
    const originalName = item.name || 'file.jpg'
    const ossPath = await generateUploadPath(originalName, item.path)

    // 上传文件到 OSS
    const uploadResult = await uploadFileToOss(
      item.path,
      ossPath,
      {
        accessKeyId: stsToken.accessKeyId,
        accessKeySecret: stsToken.accessKeySecret,
        securityToken: stsToken.securityToken,
        host: stsToken.host,
        policy: stsToken.policy,
        signature: stsToken.signature,
        callback: stsToken.callback,
      },
      (progress) => {
        uploadStore.updateMaterialProgress(item.id, progress)
      },
    )

    console.log('【上传素材】OSS 上传结果:', uploadResult)

    if (!uploadResult.success) {
      uploadStore.setMaterialFailed(item.id, uploadResult.error)
      return
    }

    // 调用预检查接口
    const preCheckRes = await preCheck({
      url: uploadResult.url!,
      category: uploadStore.currentType,
    })

    // 保存 token
    materialTokens.value.set(item.id, preCheckRes.token)

    // 如果是抖音并且是视频类型，更新缩略图为接口返回的 thumbUrl
    // #ifdef MP-TOUTIAO
    console.log(systemInfo.platform)
    if (item.type === 'video' && preCheckRes.thumbUrl && systemInfo.platform !== 'ios') {
      uploadStore.updateMaterialThumbnail(item.id, preCheckRes.thumbUrl)
    }
    // #endif

    uploadStore.updateMaterialProgress(item.id, 100, 'completed')
  }
  catch (error: any) {
    uploadStore.setMaterialFailed(item.id, error.message || '上传失败')
  }
}

/**
 * 开始上传所有素材
 */
async function startUpload() {
  // 过滤出可以上传的素材（状态为 uploading）
  const validMaterials = materialList.filter((item: any) => item.status === 'uploading')

  if (validMaterials.length === 0) {
    showCustomToast({ title: '没有可上传的素材', icon: 'none' })
    return
  }

  try {
    // 获取 STS Token
    const stsToken = await getStsToken()

    // 并行上传所有素材
    await Promise.all(
      validMaterials.map((item: any) => uploadMaterial(item, stsToken)),
    )
  }
  catch (error: any) {
    showCustomToast({ title: error.message || '上传失败', icon: 'none' })
  }
}

function touchStart(e: TouchEvent, id: string) {
  const item = materialList.find((m: any) => m.id === id)
  if (!item || item.status === 'uploading')
    return

  swipeState.value.startX = e.touches[0].clientX
  // 不要在这里设置 currentId，只在 touchEnd 中根据滑动距离设置
}

function touchEnd(e: TouchEvent, id: string) {
  const item = materialList.find((m: any) => m.id === id)
  if (!item || item.status === 'uploading')
    return

  const endX = e.changedTouches[0].clientX
  const diff = swipeState.value.startX - endX

  if (diff > 50) {
    swipeState.value.currentId = id
  }
  else if (diff < -50) {
    swipeState.value.currentId = null
  }
}

async function deleteMaterial(id: string) {
  const token = materialTokens.value.get(id)
  const item = materialList.find((m: any) => m.id === id)

  // 如果是已完成状态且有token，先调用后端删除接口
  if (item?.status === 'completed' && token) {
    try {
      await deleteCheckTokens({ tokens: [token] })
    }
    catch (error) {
      console.error('删除素材失败:', error)
      showCustomToast({ title: '删除失败，请重试', icon: 'none' })
      return
    }
  }

  uploadStore.removeMaterial(id)
  materialTokens.value.delete(id)
  swipeState.value.currentId = null

  // 如果删除后没有素材了，自动返回上一页
  if (materialList.length === 0) {
    uni.navigateBack()
  }
}

/**
 * 确认发布
 */
async function confirmPublish() {
  if (!isButtonActive.value)
    return

  // 获取所有已上传素材的 token
  const tokens = Array.from(materialTokens.value.values())

  if (tokens.length === 0) {
    showCustomToast({ title: '没有可发布的素材', icon: 'none' })
    return
  }

  try {
    await publish({
      tokens,
      ipId: selectedIp?.id,
    })
    showCustomToast({
      title: '发布成功',
      icon: 'success',
    })
    // 清空素材列表
    uploadStore.clearMaterials()
    materialTokens.value.clear()
    // 清除选中IP状态
    clearSelectedIpState()
    // 触发创作空间页面刷新素材列表
    uni.$emit('assetListNeedRefresh')
    // 返回创作空间页面（如果页面栈中有）
    setTimeout(() => {
      const pages = getCurrentPages()
      const creativeSpaceIndex = pages.findIndex(p => p.route === 'pages/creativeSpace/index')

      if (creativeSpaceIndex !== -1) {
        // 计算需要返回的层数
        const delta = pages.length - 1 - creativeSpaceIndex
        uni.navigateBack({ delta })
      }
      else {
        // 页面栈中没有，跳转到创作空间
        uni.navigateTo({
          url: '/pages/creativeSpace/index',
        })
      }
    }, 1500)
  }
  catch (error: any) {
    showCustomToast({ title: error.message || '发布失败', icon: 'none' })
  }
}

onLoad(async (options: any) => {
  if (options.type) {
    uploadStore.setCurrentType(Number(options.type))
  }
  // 校验素材
  await validateMaterials(materialList, uploadStore.currentType)
  // 开始上传
  startUpload()
})

onUnmounted(async () => {
  const tokens = Array.from(materialTokens.value.values())

  if (tokens.length > 0) {
    try {
      await deleteCheckTokens({ tokens })
    }
    catch (error) {
      console.error('清理素材失败:', error)
    }
  }

  uploadStore.clearMaterials()
  materialTokens.value.clear()
})
</script>

<template>
  <view class="relative bg-[#F5F5F5]">
    <CommonHeader mode="fixed" :scroll-top="0" bg-color="#F5F5F5" />
    <custom-title text="上传作品" text-color="text-main" />

    <view
      class="flex flex-col overflow-auto pt-20rpx"
      :style="{ marginTop: `${statusNavTotalHeight}px`, height: `calc(100vh - ${statusNavTotalHeight}px - 100rpx)` }"
    >
      <view
        class="mx-32rpx box-border h-140rpx w-auto flex items-center justify-between rounded-32rpx bg-[#F5F5F5] px-30rpx"
      >
        <view class="flex flex-col">
          <text class="text-32rpx text-main font-bold">{{ typeInfo.name }}</text>
          <text class="mt-8rpx text-24rpx text-[#666]">{{ typeInfo.tips }}</text>
        </view>
        <view class="h-92rpx w-92rpx center rounded-full bg-[#fff]">
          <image class="h-48rpx w-48rpx" :src="typeInfo.img" mode="aspectFit" />
        </view>
      </view>

      <view class="mt-24rpx flex flex-col items-center pb-80rpx">
        <view
          v-for="item in materialList" :key="item.id"
          class="relative mb-16rpx h-168rpx w-710rpx rounded-16rpx" @touchstart="touchStart($event, item.id)"
          @touchend="touchEnd($event, item.id)"
        >
          <view
            v-if="item.status !== 'uploading'"
            class="absolute right-24rpx top-0 z-0 h-full flex items-center justify-center"
            @click="deleteMaterial(item.id)"
          >
            <view class="h-168rpx w-80rpx flex items-center justify-center rounded-16rpx bg-[#FF4D4F]">
              <i class="iconfont icon-a-shuxingxianxingmingchengshanchuzhuangtaion text-40rpx text-white" />
            </view>
          </view>

          <view
            class="relative z-10 h-full w-full rounded-16rpx bg-white transition-transform duration-200"
            :style="{ transform: swipeState.currentId === item.id && item.status !== 'uploading' ? 'translateX(-128rpx)' : 'translateX(0)' }"
          >
            <view class="box-border h-full w-full flex p-24rpx">
              <!-- <image
                class="h-120rpx w-120rpx flex-shrink-0 rounded-16rpx" :src="item.thumbnail"
                mode="aspectFill"
              /> -->

              <ImagePlaceholder
                :src="item.thumbnail"
                mode="aspectFill"
                class-name="h-120rpx w-120rpx flex-shrink-0 rounded-16rpx"
              />

              <view class="ml-24rpx flex flex-1 flex-col justify-center">
                <view class="flex items-center justify-between">
                  <text class="text-32rpx text-main font-bold">{{ item.name }}</text>
                  <text class="text-28rpx font-bold" :class="statusColorMap[item.status]">
                    {{ statusTextMap[item.status] }}
                  </text>
                </view>

                <view class="mt-16rpx">
                  <template v-if="item.status === 'uploading' || item.status === 'completed'">
                    <view class="h-8rpx w-full overflow-hidden rounded-4rpx bg-[#f5f5f5]">
                      <view
                        class="h-full rounded-4rpx bg-[#07C160] transition-all duration-300"
                        :style="{ width: `${item.progress}%` }"
                      />
                    </view>
                  </template>
                  <template v-else-if="item.status === 'failed'">
                    <text class="text-28rpx text-[#666]">{{ item.failReason }}</text>
                  </template>
                </view>

                <view
                  v-if="item.status !== 'failed'"
                  class="mt-12rpx flex items-center justify-between"
                >
                  <text class="text-28rpx text-[#666]">{{ item.size }}</text>
                  <text class="text-28rpx text-[#07C160] font-bold">{{ Math.floor(item.progress) }}%</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view
      class="fixed bottom-0 left-0 z-[999] w-full flex items-center justify-between bg-[#F5F5F5] pb-40rpx pt-20rpx"
    >
      <view class="w-full flex justify-center px-30rpx">
        <view
          class="h-100rpx w-690rpx flex items-center justify-center rounded-50rpx transition-all duration-200"
          :class="isButtonActive ? 'bg-primary' : 'bg-[#ECECEC]'" @click="confirmPublish"
        >
          <text class="text-32rpx font-bold" :class="isButtonActive ? 'text-[#fff]' : 'text-[#CDCDCD]'">
            确认发布
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss"></style>
