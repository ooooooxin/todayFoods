<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { updateUserInfo } from '@/api/common'
import { showCustomToast } from '@/composables/useCustomToast'
import { useUserStore } from '@/store/user'
import { systemInfo } from '@/utils/systemInfo'

definePage({
  style: {
    navigationBarTitleText: '',
    navigationBarBackgroundColor: '#000000',
    navigationBarTextStyle: 'white',
  },
})

const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)

// 图片状态
const selectedImage = ref('')
const isImageSelected = ref(false)
const isSaving = ref(false)

// 如果用户已有头像，显示在初始页面
onMounted(() => {
  if (userInfo.value?.avatar) {
    selectedImage.value = userInfo.value.avatar
  }
})

// 裁剪区域状态（使用显示坐标系）
const cropArea = ref({
  x: 0,
  y: 0,
  scale: 1,
})

// 原始图片尺寸
const imageInfo = ref({
  width: 0,
  height: 0,
})

// 显示缩放比例（原始像素 → 屏幕像素）
const displayScale = ref(1)

// 显示尺寸（movable-view 使用的尺寸）
const displayWidth = ref(0)
const displayHeight = ref(0)
let _currentScale = 1

// ---- 配置常量（修改这里即可统一调整裁剪行为） ----
const CROP_RATIO = 0.6 // 裁剪框直径 / 屏幕宽度
const OUTPUT_SIZE = 400 // 导出图片边长 (px)
const MAX_SCALE = 3 // 最大手势缩放倍数
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png']

// 容器尺寸（圆形裁剪框）
const containerSize = ref(0)
const cropCircleSize = ref(0)

// 裁剪框距容器四边的距离（上下/左右对称）
const cropOffset = computed(() => (containerSize.value - cropCircleSize.value) / 2)

// movable-area 大小 = cropCircleSize，定位在 (cropOffset, cropOffset)
// 数学推导：native Y ∈ [areaH-viewH, 0]，容器 Y = cropOffset + nativeY ∈ [cropOffset+cropSize-viewH, cropOffset]
//          恰好等于 getBounds 返回的 [minY, maxY]，无需 out-of-bounds 即可覆盖两个方向

// 初始化尺寸
uni.getSystemInfo({
  success: (res) => {
    containerSize.value = res.windowWidth
    cropCircleSize.value = res.windowWidth * CROP_RATIO
  },
})

const isChoosing = ref(false) // 防抖：防止连续触发图片选择器
const showPermissionPopup = ref(false)
const permissionText = ref('')

// movable-view change 事件 —— 只记录位置，不做额外计算
let _lastX = 0
let _lastY = 0

// 上传新头像
function uploadNewAvatar() {
  if (isChoosing.value)
    return
  isChoosing.value = true
  uni.chooseImage({
    count: 1,
    sizeType: ['original'],
    sourceType: ['album'], // 仅支持系统相册，不支持拍照
    complete: () => {
      isChoosing.value = false
    },
    success: (res) => {
      const tempFilePath = res.tempFilePaths[0]
      const tempFile = (res.tempFiles as any[])[0]

      // 格式校验：仅支持 JPG / JPEG / PNG
      const ext = tempFilePath.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
      if (!ALLOWED_EXTS.includes(ext)) {
        showCustomToast({ title: `仅支持 JPG / PNG 格式`, icon: 'none' })
        return
      }

      // 大小校验：≤ 20MB
      if (tempFile?.size > MAX_FILE_SIZE) {
        showCustomToast({ title: `仅支持20MB内的图片`, icon: 'none' })
        return
      }

      // 获取图片信息
      uni.getImageInfo({
        src: tempFilePath,
        success: (info) => {
          selectedImage.value = tempFilePath
          isImageSelected.value = true
          imageInfo.value = {
            width: info.width,
            height: info.height,
          }

          // 计算显示缩放比例：让图片短边 = 裁剪框尺寸，确保两个方向都能拖动
          const container = containerSize.value
          const cropSize = cropCircleSize.value
          const scale = Math.max(cropSize / info.width, cropSize / info.height)
          displayScale.value = scale
          displayWidth.value = info.width * scale
          displayHeight.value = info.height * scale

          // 计算初始位置（居中）
          const initialX = (container - displayWidth.value) / 2
          const initialY = (container - displayHeight.value) / 2

          cropArea.value = {
            x: initialX,
            y: initialY,
            scale: 1, // 强制重新设置 scale-value 为 1 使得视图更新
          }
          _currentScale = 1
          _lastX = initialX
          _lastY = initialY
        },
      })
    },
    fail: (err) => {
      console.log(err)
      // #ifdef MP-WEIXIN
      if ((err.errMsg === 'chooseImage:fail:system permission denied' && systemInfo.platform !== 'ios')) {
        showPermissionPopup.value = true
        permissionText.value = '请在系统设置中开启相册权限'
      }
      // #endif
      // #ifdef MP-TOUTIAO
      if (err.errorCode === '111889') {
        showPermissionPopup.value = true
        permissionText.value = '请在系统设置中开启相册权限'
      }
      if (err.errorCode === '111890') {
        showPermissionPopup.value = true
        permissionText.value = '请在小程序设置中开启相册权限'
      }
      // #endif
    },
  })
}

// 计算最小缩放比例（确保图片覆盖裁剪框）
function getMinScale(): number {
  if (!displayWidth.value || !displayHeight.value)
    return 1
  const cs = cropCircleSize.value
  return Math.max(cs / displayWidth.value, cs / displayHeight.value)
}

// 计算边界限制（显示坐标系）
// minX/minY 对应图片右下角贴裁剪框右下角；maxX/maxY 对应图片左上角贴裁剪框左上角
function getBounds(scale: number) {
  const co = cropOffset.value
  const cs = cropCircleSize.value
  const imgW = displayWidth.value * scale
  const imgH = displayHeight.value * scale
  return {
    minX: co + cs - imgW,
    maxX: co,
    minY: co + cs - imgH,
    maxY: co,
  }
}

// 限制位置在边界内
function clampPosition(x: number, y: number, scale: number) {
  const b = getBounds(scale)
  return {
    x: Math.min(b.maxX, Math.max(b.minX, x)),
    y: Math.min(b.maxY, Math.max(b.minY, y)),
  }
}

const isDragging = ref(false)
let dragTimer: ReturnType<typeof setTimeout> | null = null

function onTouchStart() {
  isDragging.value = true
  if (dragTimer)
    clearTimeout(dragTimer)
}

function onMovableChange(e: any) {
  // movable-view 报告的是相对 movable-area 的坐标，需加回 cropOffset 转为容器坐标
  _lastX = e.detail.x + cropOffset.value
  _lastY = e.detail.y + cropOffset.value
}

// 触摸结束时回弹到合法边界
function onTouchEnd() {
  if (dragTimer)
    clearTimeout(dragTimer)
  dragTimer = setTimeout(() => {
    isDragging.value = false
  }, 200)

  // 强制缩放不低于最小值
  const minScale = getMinScale()
  if (_currentScale < minScale) {
    _currentScale = minScale
  }

  // 先同步缩放值回 movable-view（触发 UI 恢复）
  cropArea.value.scale = _currentScale

  // 再回弹位置
  const { x, y } = clampPosition(_lastX, _lastY, _currentScale)
  cropArea.value.x = x
  cropArea.value.y = y
  _lastX = x
  _lastY = y
}

// 缩放手势（实时记录缩放值，不主动写回 cropArea.value.scale 以避免跟 native 冲突卡顿）
function onScaleChange(e: any) {
  _currentScale = e.detail.scale
  // 缩放时实时检查位置是否越界，若越界则记录修正的位置（touchend 时执行回弹）
  const { x, y } = clampPosition(_lastX, _lastY, _currentScale)
  _lastX = x
  _lastY = y
}

// 取消
function handleCancel() {
  isImageSelected.value = false
  if (userInfo.value?.avatar) {
    selectedImage.value = userInfo.value.avatar
  }
  else {
    selectedImage.value = ''
  }
}

// 保存
async function handleSave() {
  if (!isImageSelected.value) {
    showCustomToast({ title: '请先选择图片', icon: 'none' })
    return
  }
  if (isSaving.value)
    return
  isSaving.value = true

  // 先同步最新位置
  cropArea.value.x = _lastX
  cropArea.value.y = _lastY

  try {
    uni.showLoading({ title: '裁剪中...', mask: true })

    // 1. 使用 canvas 裁剪图片
    const croppedImagePath = await cropImage()

    uni.showLoading({ title: '上传中...', mask: true })

    // 2. 压缩图片确保文件流完整（canvas 临时文件可能不完整）
    const compressedPath = await new Promise<string>((resolve, reject) => {
      uni.compressImage({
        src: croppedImagePath,
        quality: 90,
        success: res => resolve(res.tempFilePath),
        fail: () => resolve(croppedImagePath),
      })
    })

    console.log('uploadFilePath---', compressedPath)

    // 3. 通过 /file/upload 接口上传到 OSS（服务端转发）
    const avatarUrl = await new Promise<string>((resolve, reject) => {
      uni.uploadFile({
        url: '/file/upload',
        filePath: compressedPath,
        formData: { foldersPrefix: 'avatar' },
        name: 'file',
        success: (res) => {
          try {
            const responseData = JSON.parse(res.data)
            if (responseData.success && responseData.result) {
              resolve(responseData.result)
            }
            else {
              reject(new Error('上传失败，请重试'))
            }
          }
          catch {
            reject(new Error('响应解析失败'))
          }
        },
        fail: () => {
          reject(new Error('上传失败，请重试'))
        },
      })
    })

    // 4. 调用接口更新用户头像
    await updateUserInfo({ avatar: avatarUrl })

    // 5. 刷新用户信息
    await userStore.fetchUserInfo()

    uni.hideLoading()
    showCustomToast({ title: '头像更新成功', icon: 'success' })

    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  }
  catch (error: any) {
    uni.hideLoading()
    showCustomToast({ title: error.message || '上传失败', icon: 'none' })
  }
  finally {
    isSaving.value = false
  }
}

// 裁剪图片
function cropImage(): Promise<string> {
  return new Promise((resolve, reject) => {
    const ctx = uni.createCanvasContext('avatarCanvas')

    const currentScale = _currentScale
    const co = cropOffset.value // 裁剪框与容器边缘的距离
    const cs = cropCircleSize.value // 裁剪框直径

    // 图片在容器中的位置（显示坐标系）
    const imgX = cropArea.value.x
    const imgY = cropArea.value.y

    // 将显示坐标系下的裁剪偏移转换回原始像素坐标
    const totalDisplayScale = displayScale.value * currentScale
    const offsetX = (co - imgX) / totalDisplayScale
    const offsetY = (co - imgY) / totalDisplayScale
    const srcCropSize = cs / totalDisplayScale

    // 绘制裁剪后的图片
    ctx.drawImage(
      selectedImage.value,
      offsetX,
      offsetY,
      srcCropSize,
      srcCropSize,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE,
    )

    ctx.draw(false, () => {
      setTimeout(() => {
        uni.canvasToTempFilePath({
          canvasId: 'avatarCanvas',
          destWidth: OUTPUT_SIZE,
          destHeight: OUTPUT_SIZE,
          fileType: 'png',
          success: (res) => {
            resolve(res.tempFilePath)
          },
          fail: (err) => {
            reject(err || new Error('图片裁剪失败'))
          },
        })
      }, 500)
    })
  })
}
</script>

<template>
  <view class="min-h-screen bg-black">
    <custom-title text="编辑头像" text-color="text-white" />
    <!-- 裁剪区域 -->
    <view v-if="!isImageSelected" class="h-screen flex flex-col items-center justify-center">
      <view class="flex flex-col items-center">
        <view class="mb-[80rpx] h-[400rpx] w-[400rpx] flex items-center justify-center overflow-hidden rounded-full">
          <image v-if="selectedImage" class="h-full w-full" :src="selectedImage" mode="aspectFill" />
          <text v-else class="text-[120rpx] text-white font-bold">KANOO</text>
        </view>
        <view
          class="h-[88rpx] w-[320rpx] flex items-center justify-center rounded-[44rpx] bg-[rgba(255,255,255,0.2)]"
          @tap="uploadNewAvatar"
        >
          <text class="text-[28rpx] text-white">上传新头像</text>
        </view>
      </view>
    </view>

    <view v-else class="relative h-screen w-full overflow-hidden">
      <!-- 背景模糊层 -->
      <image
        :src="selectedImage"
        mode="aspectFill"
        class="absolute left-0 top-0 h-full w-full opacity-30 blur-[20px]"
      />

      <!-- 裁剪容器 -->
      <view
        class="absolute left-0 top-[20%] w-full"
        :style="{ height: `${containerSize}px` }"
        @touchmove.stop
      >
        <!-- movable-area: cropCircleSize 正方形，定位在裁剪框左上角 -->
        <!-- nativeY ∈ [cropSize-viewH, 0] → 容器Y = cropOffset+nativeY ∈ [minY, maxY] -->
        <movable-area
          class="absolute"
          scale-area
          :style="{
            left: `${cropOffset}px`,
            top: `${cropOffset}px`,
            width: `${cropCircleSize}px`,
            height: `${cropCircleSize}px`,
          }"
        >
          <!-- 可移动的图片 (x/y 转为 movable-area 坐标系：容器坐标 - cropOffset) -->
          <movable-view
            :x="cropArea.x - cropOffset"
            :y="cropArea.y - cropOffset"
            :scale="true"
            :scale-min="getMinScale()"
            :scale-max="MAX_SCALE"
            :scale-value="cropArea.scale"
            direction="all"
            :damping="10"
            :style="{
              width: `${displayWidth}px`,
              height: `${displayHeight}px`,
            }"
            @change="onMovableChange"
            @scale="onScaleChange"
            @touchstart="onTouchStart"
            @touchend="onTouchEnd"
            @touchcancel="onTouchEnd"
          >
            <image
              :src="selectedImage"
              mode="aspectFill"
              class="h-full w-full"
            />
          </movable-view>
        </movable-area>

        <!-- 圆形裁剪框遮罩：在容器内定位，不随 movable-area 尺寸变化 -->
        <view class="pointer-events-none absolute left-0 top-0 h-full w-full">
          <view
            class="absolute box-border border-[4rpx] border-white rounded-full border-solid transition-shadow duration-300"
            :style="{
              width: `${cropCircleSize}px`,
              height: `${cropCircleSize}px`,
              left: `${cropOffset}px`,
              top: `${cropOffset}px`,
              boxShadow: `0 0 0 9999px ${isDragging ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.8)'}`,
            }"
          />
        </view>
      </view>

      <!-- 底部操作按钮 -->
      <view class="fixed bottom-[80rpx] left-0 z-[999] w-full flex items-center justify-center gap-[40rpx]">
        <view
          class="h-[88rpx] w-[280rpx] flex items-center justify-center rounded-[44rpx] bg-[rgba(255,255,255,0.2)]"
          @tap="handleCancel"
        >
          <text class="text-[32rpx] text-white">取消</text>
        </view>
        <view
          class="h-[88rpx] w-[280rpx] flex items-center justify-center rounded-[44rpx] bg-[#333]"
          @tap="handleSave"
        >
          <text class="text-[32rpx] text-white font-medium">保存</text>
        </view>
      </view>
    </view>

    <!-- 隐藏的 canvas 用于裁剪 -->
    <canvas
      canvas-id="avatarCanvas"
      class="fixed left-[-9999px] top-[-9999px]"
      :style="{ width: `${OUTPUT_SIZE}px`, height: `${OUTPUT_SIZE}px` }"
    />

    <!-- 权限弹窗 -->
    <ConfirmPopup
      v-model:visible="showPermissionPopup"
      title="无法访问相册"
      :message="permissionText"
      :show-cancel="false"
      confirm-text="我知道了"
      @confirm="showPermissionPopup = false"
    />
  </view>
</template>

<style scoped>
.blur-20 {
  filter: blur(20px);
}
</style>
