<template>
  <view class="login-container">
    <!-- <CommonHeader mode="auto" :scroll-top="0" /> -->
    <custom-title text="登录" text-color="text-main" />
    <!-- Logo 区域 -->
    <view class="logo-box">
      <image
        class="logo-img"
        :class="{ 'logo-img--loaded': logoLoaded }"
        src="/static/images/logo3d.png"
        mode="widthFix"
        @load="logoLoaded = true"
      />
    </view>

    <!-- 登录表单区域 -->
    <view class="form-box">
      <!-- #ifdef MP-TOUTIAO -->
      <view class="btn-phone" @click="navToPhoneLogin">
        <text>手机验证登录</text>
      </view>
      <!-- #endif -->
      <!-- #ifdef MP-WEIXIN -->
      <view class="btn-phone">
        <text>手机号一键登录</text>
        <button
          v-if="agreed"
          class="btn-phone-cover" hover-class="none" data-eventsync="true"
          open-type="getPhoneNumber" @getphonenumber="handleWechatPhoneLogin"
        />
        <button
          v-else
          class="btn-phone-cover" hover-class="none" data-eventsync="true"
          @click="handleWechatPhoneLogin"
        />
      </view>
      <!-- #endif -->

      <!-- 协议勾选 -->
      <view class="agreement-box" style="flex-wrap: wrap;" @click="agreed = !agreed">
        <fg-checkbox v-model="agreed" size="32rpx" class="mr-12rpx" />
        <text class="text">我已阅读并同意</text>
        <view class="inline-flex flex-wrap items-center">
          <text class="link" @click.stop="navToAgreement('service')">《用户服务协议》</text>
          <text class="link" @click.stop="navToAgreement('privacy')">《用户隐私政策》</text>
        </view>
        <br>
        <text class="text line-height-40rpx">未注册的手机号验证后将创建Kanoo账号</text>
      </view>
    </view>

    <!-- #ifdef MP-TOUTIAO -->
    <button
      class="btn-douyin-text" hover-class="none" data-eventsync="true"
      @click="handleDouyinAuthTap"
    >
      抖音一键登录
    </button>
    <!-- #endif -->
    <!-- #ifdef MP-WEIXIN -->
    <button
      class="btn-douyin-text" hover-class="none" data-eventsync="true"
      @click="navToPhoneLogin"
    >
      其他手机号登录
    </button>
    <!-- #endif -->
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { MultiAccountError } from '@/api/login'
import { showCustomToast } from '@/composables/useCustomToast'
import { useSystemConfig } from '@/composables/useSystemConfig'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { navigateAfterLogin } from '@/utils/toLoginPage'

declare const tt: any

definePage({
  style: {
    navigationBarTitleText: '登录',
  },
})

const logoLoaded = ref(false)
const agreed = ref(false)
const tokenStore = useTokenStore()

function checkAgreement() {
  if (!agreed.value) {
    showCustomToast({ title: '请先阅读并勾选《用户服务协议》与《隐私政策》', icon: 'none' })
    return false
  }
  return true
}

function handleDouyinAuthTap() {
  if (!checkAgreement())
    return

  // 在用户点击手势内调用 getUserProfile
  uni.getUserProfile({
    desc: '用于完善会员资料', // 声明获取用户个人信息后的用途，后续会展示在弹窗中，请谨慎填写
    success: (res) => {
      handleDouyinLogin(res)
    },
    fail() {
      return showCustomToast({
        title: '请允许授权',
        icon: 'none',
      })
    },
  })
}

async function handleDouyinLogin(res: any) {
  try {
    // #ifdef MP-TOUTIAO
    uni.showLoading({ title: '登录中...' })

    // 1. 获取 code
    const loginRes = await new Promise<any>((resolve, reject) => {
      tt.login({
        success: resolve,
        fail: reject,
      })
    })

    console.log('loginRes', loginRes, res)

    // 2. 使用 code 和用户信息登录
    await tokenStore.douYinMpLogin({
      code: loginRes.code,
      encryptedData: res.encryptedData,
      iv: res.iv,
    })

    // 3. 登录成功，返回原页面（或首页）
    navigateAfterLogin()
    // #endif
  }
  catch (error) {
    console.error('抖音登录失败:', error)
    showCustomToast({ title: error?.message || '登录失败，请重试', icon: 'none' })
  }
  finally {
    uni.hideLoading()
  }
}

async function handleWechatPhoneLogin(e: any) {
  // #ifdef MP-WEIXIN
  if (!checkAgreement())
    return

  // 非点击按钮授权
  if (!e.detail.errMsg) {
    showCustomToast({
      title: '请重新点击按钮',
      icon: 'none',
    })
    return
  }
  // 用户拒绝授权
  if (e.detail.errMsg !== 'getPhoneNumber:ok') {
    showCustomToast({
      title: '请允许获取手机号',
      icon: 'none',
    })
    return
  }

  try {
    uni.showLoading({ title: '登录中...' })

    // 1. 获取微信登录 code
    const loginRes = await new Promise<UniApp.LoginRes>((resolve, reject) => {
      uni.login({
        provider: 'weixin',
        success: resolve,
        fail: reject,
      })
    })

    console.log('微信手机号登录-code:', loginRes.code)
    console.log('微信手机号登录:', e.detail)

    // 2. 使用 code 和手机号信息登录
    await tokenStore.wxLogin({
      loginCode: loginRes.code,
      phoneCode: e.detail.code,
    })

    // 3. 登录成功，返回原页面（或首页）
    navigateAfterLogin()
  }
  catch (error: any) {
    console.error('微信手机号登录失败:', error)

    // 处理手机号关联多账号的情况（code=2004）
    if (error instanceof MultiAccountError) {
      const { authTicket, accountList } = error.data
      const userStore = useUserStore()
      userStore.authTicket = authTicket
      userStore.accountList = accountList

      // 跳转到切换账号页面
      uni.redirectTo({
        url: `/pages/me/switchAccount`,
      })
      return
    }

    showCustomToast({ title: error?.message || '登录失败，请重试', icon: 'none' })
  }
  finally {
    uni.hideLoading()
  }
  // #endif
}

function navToPhoneLogin() {
  // if (!checkAgreement())
  //   return

  // 如果要一进入就自动勾选协议就加上?autoAgreed=1
  const url = `/pages/login/phone?agreed=${agreed.value ? 1 : 0}`
  uni.navigateTo({ url })
}

const { navToAgreement } = useSystemConfig()
</script>

<style lang="scss" scoped>
.login-container {
  min-height: 100vh;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.logo-box {
  margin-bottom: 120rpx;
  width: 750rpx;
  height: 686rpx;
  display: flex;
  justify-content: center;
  // align-items: center;

  .logo-img {
    width: 444rpx;
    height: 444rpx;
    opacity: 0;
    transition: opacity 0.3s ease;
    margin-top: 216rpx;

    &--loaded {
      opacity: 1;
    }
  }
}

.form-box {
  width: 100%;
  padding: 0 60rpx;
  box-sizing: border-box;
}

.btn-phone {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #333;
  color: #fff;
  border: none;
  border-radius: 48rpx;
  height: 96rpx;
  font-size: 32rpx;
  font-weight: 600;
}

.btn-phone-cover {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  border: none;
  background: transparent;
}

.agreement-box {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 40rpx;
  font-size: 24rpx;

  .text {
    color: #999999;
  }

  .link {
    color: #134294;
  }
}

.btn-douyin-text {
  position: absolute;
  bottom: calc(100rpx + env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  background-color: transparent;
  padding: 0;
  margin: 0;
  line-height: normal;
  font-size: 28rpx;
  color: #666666;

  &::after {
    display: none;
  }

  .undeline-text {
    font-size: 24rpx;
    color: #666;
    text-decoration: underline;
  }
}
</style>
