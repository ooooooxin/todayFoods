<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'

definePage({
  style: {
    navigationBarTitleText: '设置',
  },
})

const tokenStore = useTokenStore()
const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)
const hasMultiAccount = computed(() => userStore.hasMultiAccount)

const showLogoutPopup = ref(false)

function goToAbout() {
  uni.navigateTo({ url: '/pages/settings/about' })
}

function goToSwitchAccount() {
  const userStore = useUserStore()
  userStore.authTicket = ''
  uni.navigateTo({
    url: `/pages/me/switchAccount`,
  })
}

function handleLogout() {
  showLogoutPopup.value = true
}

function cancelLogout() {
  showLogoutPopup.value = false
}

function confirmLogout() {
  showLogoutPopup.value = false
  tokenStore.logout()
  uni.reLaunch({ url: '/pages/index/index' })
}
</script>

<template>
  <view class="min-h-screen bg-[#f5f5f5]">
    <CommonHeader mode="auto" :scroll-top="0" />
    <custom-title text="设置" text-color="text-main" />
    <view class="px-32rpx pt-24rpx">
      <!-- 关于KANOO -->
      <view
        class="mb-20rpx flex items-center justify-between rounded-24rpx bg-white px-32rpx py-32rpx"
        @click="goToAbout"
      >
        <view class="flex items-center gap-24rpx">
          <i class="iconfont icon-a-shuxingxianxingmingchengguanyuwomenzhuangtaion text-36rpx" />
          <text class="text-28rpx text-[#333] line-height-[48rpx]">关于Kanoo</text>
        </view>
        <i class="iconfont icon-a-shuxingxianxingmingchengtiaozhuanzhuangtaioff rotate-180 text-40rpx text-[#999]" />
      </view>

      <!-- 切换账号/退出登录 -->
      <view v-if="hasMultiAccount" class="overflow-hidden rounded-24rpx bg-white">
        <view
          class="flex items-center justify-center py-32rpx"
          @click="goToSwitchAccount"
        >
          <text class="text-28rpx text-[#333] line-height-[48rpx]">切换账号</text>
        </view>
        <view class="h-[1rpx] bg-[rgba(102,102,102,0.1)]" />
        <view
          class="flex items-center justify-center py-32rpx"
          @click="handleLogout"
        >
          <text class="text-28rpx text-[#333] line-height-[48rpx]">退出登录</text>
        </view>
      </view>

      <!-- 单独退出登录（无多账号时） -->
      <view
        v-else
        class="flex items-center justify-center overflow-hidden rounded-24rpx bg-white py-32rpx"
        @click="handleLogout"
      >
        <text class="text-28rpx text-[#333]">退出登录</text>
      </view>
    </view>

    <!-- 退出登录确认弹窗 -->
    <ConfirmPopup
      v-model:visible="showLogoutPopup"
      title="温馨提示"
      :message="`确定退出该账号<br/><b><span class='text-[#333]'>${userInfo.nickname || ''}</span></b> 吗？`"
      confirm-text="退出登录"
      @confirm="confirmLogout"
    />
  </view>
</template>
