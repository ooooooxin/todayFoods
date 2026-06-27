<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { getCreatorPublicInfo, getQrCode } from '@/api/me/me'
import { useUserStore } from '@/store/user'
import { getImgUrl } from '@/utils'

definePage({
  style: {
    navigationBarTitleText: '',
  },
})

const userStore = useUserStore()

const qrCodeUrl = ref('')
const showRefresh = ref(false)
const userInfo = ref({
  avatar: '',
  nickname: '',
  uniqueCode: '',
  bannerUrl: '',
  backgroundUrl: '',
})

onLoad((options) => {
  const fromCreator = options?.fromCreator
  if (fromCreator === '1') {
    const creatorId = options?.creatorId
    if (creatorId) {
      fetchCreatorInfo(Number(creatorId))
    }
  }
  else {
    fetchUserInfo()
  }
  fetchQrCode()
})

async function fetchUserInfo() {
  try {
    await userStore.fetchUserInfo()
    userInfo.value = {
      avatar: userStore.userInfo.avatar || '',
      nickname: userStore.userInfo.nickname || '',
      uniqueCode: userStore.userInfo.uniqueCode || '',
      bannerUrl: userStore.userInfo.bannerUrl || '',
      backgroundUrl: userStore.userInfo.backgroundUrl || '',
    }
  }
  catch (error) {
    console.error('获取用户信息失败', error)
  }
}

async function fetchCreatorInfo(creatorId: number) {
  try {
    const res = await getCreatorPublicInfo(creatorId)
    userInfo.value = {
      avatar: res.avatar || '',
      nickname: res.nickname || '',
      uniqueCode: res.uniqueCode || '',
      bannerUrl: res.bannerUrl || '',
      backgroundUrl: res.backgroundUrl || '',
    }
  }
  catch (error) {
    console.error('获取创作者信息失败', error)
  }
}

async function fetchQrCode() {
  try {
    const result = await getQrCode()
    if (result) {
      qrCodeUrl.value = `data:image/png;base64,${result}`
      showRefresh.value = false
    }
  }
  catch {
    showRefresh.value = true
  }
}

function handleRefresh() {
  fetchQrCode()
}
</script>

<template>
  <view class="relative min-h-screen">
    <image
      :src="getImgUrl('/assets/mp/temp/qr_bg.png')"
      mode="scaleToFill"
      class="absolute left-0 top-0 h-full w-full"
    />
    <!-- <view class="absolute left-0 top-0 h-full w-full backdrop-blur-[10rpx]" /> -->

    <view class="absolute left-50% top-50% translate-x-[-50%] translate-y-[-50%]">
      <!-- 官方帐号banner -->
      <image v-if="userInfo.bannerUrl" class="relative top-[32rpx] block h-[122rpx] w-[574rpx]" :src="userInfo.bannerUrl" mode="scaleToFill" />

      <view class="relative h-[916rpx] w-[574rpx] flex flex-col items-center rounded-32rpx bg-white">
        <!-- 顶部背景 -->
        <image
          :src="userInfo.backgroundUrl || '/static/images/top_bg.png'"
          mode="scaleToFill"
          class="absolute left-24rpx top-[24rpx] h-[482rpx] w-[526rpx] rounded-t-20rpx"
        />

        <!-- 锯齿图片 -->
        <image
          src="@/static/images/login_popup_top.png"
          mode="scaleToFill"
          class="relative top-[160rpx] h-[120rpx] w-[530rpx]"
        />

        <view class="relative top-[158rpx] h-[602rpx] w-[530rpx] center bg-white">
          <!-- 二维码框 -->
          <image
            src="@/static/images/qrcode_out.png"
            mode="scaleToFill"
            class="absolute left-50% top-50% h-[384rpx] w-[404rpx] translate-x-[-50%] translate-y-[-50%]"
          />

          <!-- 二维码图片 -->
          <image
            v-if="qrCodeUrl"
            :src="qrCodeUrl"
            mode="scaleToFill"
            class="absolute left-50% top-50% h-[296rpx] w-[296rpx] translate-x-[-50%] translate-y-[-50%]"
          />

          <!-- 刷新按钮（渲染失败时显示） -->
          <view v-else class="h-[296rpx] w-[296rpx] center flex-col" @click="handleRefresh">
            <image
              src="@/static/images/refresh.png"
              mode="scaleToFill"
              class="mb-[16rpx] h-[72rpx] w-[72rpx]"
            />
            <text class="text-[24rpx] text-[#333]">点击刷新</text>
          </view>
        </view>

        <!-- 标语 -->
        <image
          src="@/static/images/slogan.png"
          mode="scaleToFill"
          class="absolute left-[42rpx] top-[246rpx] h-[94rpx] w-[190rpx]"
        />

        <!-- 头像/昵称 -->
        <view class="absolute right-[50rpx] top-[130rpx] center flex-col">
          <image
            :src="userInfo.avatar || '/static/images/default_picture.png'"
            mode="scaleToFill"
            class="mb-16rpx h-[144rpx] w-[144rpx] border-[8rpx] border-[#fff] rounded-50% border-solid"
          />
          <view class="w-[250rpx] overflow-hidden text-ellipsis whitespace-nowrap text-center">
            <text class="text-ellipsis text-[32rpx] text-[#333] font-bold">{{ userInfo.nickname || userInfo.uniqueCode }}</text>
          </view>
        </view>

        <!-- logo -->
        <image
          src="@/static/images/logo.png"
          mode="scaleToFill"
          class="absolute bottom-[46rpx] left-50% h-[40rpx] w-[86rpx] translate-x-[-50%]"
        />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss"></style>
