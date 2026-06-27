<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { showCustomToast } from '@/composables/useCustomToast'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { statusNavTotalHeight } from '@/utils/systemInfo'
import { navigateAfterLogin } from '@/utils/toLoginPage'

definePage({
  style: {
    navigationBarTitleText: '切换账号',
    navigationStyle: 'custom',
  },
})

const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)
const tokenStore = useTokenStore()

const authTicket = ref('')
const accountList = ref<any[]>([])

onLoad(async () => {
  if (userStore.authTicket) {
    authTicket.value = userStore.authTicket

    if (userStore.accountList && userStore.accountList.length > 0) {
      accountList.value = formatAccountList(userStore.accountList)
    }
  }
  else {
    if (!tokenStore.hasLogin) {
      uni.reLaunch({ url: '/pages/login/index' })
      return
    }

    // 默认回退逻辑，如果在已登录状态下进入，显示当前账号数据并拉取关联账号
    uni.showLoading({ title: '加载中...' })

    try {
      // 强制刷新关联账号，确保数据最新
      const storeAccounts = await userStore.fetchAssociatedAccounts(true)
      if (!storeAccounts || storeAccounts.length === 0) {
        // 如果没有store数据，直接跳转到登录页面
        uni.reLaunch({ url: '/pages/login/index' })
      }
      else {
        accountList.value = formatAccountList(storeAccounts)
      }
    }
    catch (e) {
      uni.reLaunch({ url: '/pages/login/index' })
    }
    finally {
      uni.hideLoading()
    }
  }
})

function formatAccountList(list: any[]) {
  return list.map((item: any) => ({
    ...item,
    targetAccountId: item.id || item.accountId,
    avatar: item.avatar || '/static/images/default_picture.png',
    isCurrent: item.current || false,
  }))
}

function getErrorTitle(e: any, fallback: string): string {
  const msg: string = e?.message ?? e?.errMsg ?? ''
  if (/network error|request:fail|ERR_INTERNET_DISCONNECTED|net::ERR/i.test(msg))
    return '网络异常，请检查网络'
  return e?.message || fallback
}

async function handleSelectAccount(account: any) {
  if (account.isCurrent)
    return

  if (authTicket.value) {
    // 如果是从登录接口带来的多账号，选择其中一个登录
    try {
      uni.showLoading({ title: '登录中...' })
      await tokenStore.selectAccountLogin({
        authTicket: authTicket.value,
        accountId: account.targetAccountId,
      })
      navigateAfterLogin()
    }
    catch (e: any) {
      console.error('选择账号登录失败', e)
      uni.hideLoading()
      if (e?.code === 2005 || e?.code === '2005') {
        setTimeout(() => {
          showCustomToast({ title: '登录信息已过期，请重新登录', icon: 'none', duration: 2500 })
        }, 100)
        setTimeout(() => {
          uni.reLaunch({ url: '/pages/login/index' })
        }, 1500)
        return
      }
      else {
        setTimeout(() => {
          showCustomToast({ title: getErrorTitle(e, '登录失败，请重试'), icon: 'none', duration: 2500 })
        })
      }
    }
    finally {
      uni.hideLoading()
    }
  }
  else {
    // 如果是已登录用户从设置页进入，点击切换其他账号
    try {
      uni.showLoading({ title: '切换中...' })
      await tokenStore.switchAccountLoginStore({
        targetAccountId: account.targetAccountId,
      })
      uni.reLaunch({ url: '/pages/index/index' })
    }
    catch (e: any) {
      console.error('切换账号登录失败', e)
      uni.hideLoading()
      if (e?.code === 2005 || e?.code === '2005') {
        setTimeout(() => {
          showCustomToast({ title: '登录信息已过期，请重新登录', icon: 'none', duration: 2500 })
        }, 100)
        setTimeout(() => {
          uni.reLaunch({ url: '/pages/login/index' })
        }, 1500)
        return
      }
      setTimeout(() => {
        showCustomToast({ title: getErrorTitle(e, '切换失败，请重试'), icon: 'none', duration: 2500 })
      })
    }
    finally {
      uni.hideLoading()
    }
  }
}
</script>

<template>
  <view class="switch-account-page">
    <custom-title text="请选择登录账号" text-color="text-main" />

    <!-- 顶部背景图（覆盖整个顶部区域） -->
    <!-- <image
      class="bg-image"
      :src="getImgUrl('/assets/mp/temp/bg4.png')"
      mode="scaleToFill"
    /> -->

    <!-- 内容区域 -->
    <view class="content" :style="{ paddingTop: `${statusNavTotalHeight + 20}px` }">
      <!-- 页面标题图片 -->
      <!-- <view class="page-title-wrap">
        <image class="title-img" src="/static/images/select_account.png" mode="widthFix" />
      </view> -->

      <!-- 账号列表 -->
      <scroll-view class="account-scroll-view" scroll-y>
        <view class="account-list">
          <view
            v-for="account in accountList"
            :key="account.id"
            class="account-item"
            :class="account.isCurrent ? 'account-item--current' : ''"
            @click="handleSelectAccount(account)"
          >
            <view class="flex items-center">
              <!-- 头像 -->
              <view class="avatar-wrap">
                <image class="avatar" :src="account.avatar" mode="aspectFill" @error="account.avatar = '/static/images/default_picture.png'" />
              </view>

              <!-- 账号信息 -->
              <view class="account-info">
                <text class="account-name">{{ account.nickname }}</text>
                <text class="account-code">Kanoo号：{{ account.uniqueCode }}</text>
              </view>
            </view>
            <!-- 官方帐号 -->
            <view v-if="account.level === 4" class="official-badge mt-20rpx inline-flex items-center border border-[rgba(102,102,102,0.1)] rounded-8rpx border-solid bg-[#F5F5F5] px-[12rpx] py-[4rpx] text-20rpx text-[#999]">
              <text>{{ account.seriesName }} · 认证作者</text>
            </view>
            <!-- 当前账号标签 -->
            <view v-if="account.isCurrent" class="current-tag">
              <image class="current-tag-img" src="/static/images/current_account.png" mode="widthFix" />
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.switch-account-page {
  position: relative;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #f5f5f5;
  // background: linear-gradient(180deg, #f6ffdf 0%, #ffffff 45%);
}

.bg-image {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 500rpx;
  z-index: 0;
}

.content {
  position: relative;
  z-index: 10;
  box-sizing: border-box;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.page-title-wrap {
  padding: 32rpx 30rpx 40rpx;
  flex-shrink: 0;
}

.title-img {
  width: 452rpx;
  height: 84rpx;
}

.account-scroll-view {
  flex: 1;
  min-height: 0;
}

.account-list {
  padding: 0 30rpx 60rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.account-item {
  display: flex;
  flex-direction: column;
  // align-items: center;
  border-radius: 32rpx;
  padding: 24rpx 24rpx;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  min-height: 132rpx;
  background-color: #ffffff;
  border: 4rpx solid transparent;
}

.account-item--current {
  border: 4rpx solid #333;
}

.avatar-wrap {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar {
  width: 100%;
  height: 100%;
}

.account-info {
  flex: 1;
  margin-left: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.account-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #181818;
  line-height: 44rpx;
}

.account-code {
  font-size: 24rpx;
  color: #999999;
  line-height: 34rpx;
}

.current-tag {
  position: absolute;
  top: -2rpx;
  right: -2rpx;
}

.current-tag-img {
  width: 130rpx;
}

.official-badge {
  align-self: flex-start;
}
</style>
