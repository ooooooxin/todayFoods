<template>
  <view class="login-container">
    <custom-title text="手机登录" text-color="text-main" />
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
      <view class="input-group" :class="{ 'has-input': phone.length > 0 }">
        <view class="prefix">
          +86
        </view>
        <view class="divider" />
        <input
          :value="phone"
          type="number"
          placeholder="请输入手机号"
          :maxlength="11"
          class="input-item"
          @input="onPhoneInput"
        >
        <view v-if="phone.length > 0" class="clear-btn" @click.stop="phone = ''">
          <text class="clear-text">✕</text>
        </view>
      </view>
      <view class="input-group" :class="{ 'has-input': code.length > 0 }">
        <input
          :value="code"
          type="number"
          placeholder="请输入验证码"
          :maxlength="5"
          class="input-item"
          @input="onCodeInput"
        >
        <view
          class="code-text"
          :class="{ disabled: countdown > 0 || !isPhoneValid }"
          @click="sendCode"
        >
          {{ countdown > 0 ? `重新发送 ${countdown}s` : '获取验证码' }}
        </view>
      </view>
      <view
        class="btn-submit"
        :class="{ disabled: !isPhoneValid || code.length < 5 }"
        @click="handlePhoneLogin"
      >
        <text>登录</text>
      </view>

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
  </view>
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed, onUnmounted, ref } from 'vue'
import { MultiAccountError, sendSmsCode } from '@/api/login'
import { showCustomToast } from '@/composables/useCustomToast'
import { useSystemConfig } from '@/composables/useSystemConfig'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { navigateAfterLogin } from '@/utils/toLoginPage'

definePage({
  style: {
    navigationBarTitleText: '手机验证登录',
  },
})

const phone = ref('')
const code = ref('')
const agreed = ref(false)
const countdown = ref(0)
const logoLoaded = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const tokenStore = useTokenStore()

function checkAgreement(handler?: () => void) {
  if (!agreed.value) {
    showCustomToast({ title: '请先阅读并勾选《用户服务协议》与《隐私政策》', icon: 'none' })
    return false
  }
  return true
}

/** 提示停留时长；hideLoading 后需延迟再 showToast，否则小程序上 toast 会一闪而过 */
const TOAST_DURATION_MS = 2500
const TOAST_AFTER_LOADING_DELAY_MS = 300

// ... omitted watch blocks for brevity ...
/**
 * 受控输入：在 @input 中一次性完成 “过滤非数字 + 截断限长” 再回写。
 * 系统兼容性考量：原来使用 v-model + watch 过滤的方式在粘贴时会出现显示值与数据值不一致：
 * native input 受 maxlength 影响已截断显示，但 watch 回写 code.value 时视图层未同步重渲染，导致提交时值多于显示值。
 * 受控模式下数据与显示始终同源，注意粘贴后立刻打印实际 code.value 与 input 显示一致。
 */
function onPhoneInput(e: any) {
  const raw = String(e?.detail?.value ?? '')
  phone.value = raw.replace(/\D/g, '').slice(0, 11)
}

function onCodeInput(e: any) {
  const raw = String(e?.detail?.value ?? '')
  code.value = raw.replace(/\D/g, '').slice(0, 5)
}

onLoad((options) => {
  if (options?.agreed === '1') {
    agreed.value = true
  }
})

// 简单的手机号正则校验
const isPhoneValid = computed(() => /^1[3-9]\d{9}$/.test(phone.value))

async function sendCode() {
  if (countdown.value > 0 || !isPhoneValid.value)
    return

  try {
    uni.showLoading({ title: '发送中...' })

    // 先开始倒计时防止多次触发
    countdown.value = 60
    timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0 && timer) {
        clearInterval(timer)
        timer = null
      }
    }, 1000)

    // 调用发送验证码接口
    await sendSmsCode({
      phone: phone.value,
      codeFlag: 'LOGIN',
    })

    uni.hideLoading()
    setTimeout(() => {
      showCustomToast({ title: '验证码已发送', icon: 'success', duration: TOAST_DURATION_MS })
    }, TOAST_AFTER_LOADING_DELAY_MS)
  }
  catch (error: any) {
    console.error('发送验证码失败:', error)

    // 如果失败，结束倒计时，允许重新获取
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    countdown.value = 0

    uni.hideLoading()

    let errMsg = error?.data?.message || error?.data?.msg || error?.message || error?.msg || (typeof error === 'string' ? error : '验证码发送失败，请重试')
    if (errMsg.startsWith('Error: ')) {
      errMsg = errMsg.replace('Error: ', '')
    }

    if (error?.errMsg?.includes('request:fail') || errMsg.includes('网络') || errMsg.includes('network') || errMsg.includes('Network') || errMsg.includes('request:fail')) {
      errMsg = '网络异常，请重试'
    }

    // 如果返回 1001，说明需要滑块验证
    const toastTitle = error?.data?.code === 1001 ? '需要滑块验证，请稍后重试' : errMsg
    setTimeout(() => {
      showCustomToast({ title: toastTitle, icon: 'none', duration: TOAST_DURATION_MS })
    }, TOAST_AFTER_LOADING_DELAY_MS)
  }
}

async function handlePhoneLogin() {
  // 如果手机号无效、未输入验证码长度不够、或是未勾选协议，直接拦截（按钮此时也为不可点击态）
  if (!isPhoneValid.value || !code.value || code.value.length !== 5 || !checkAgreement(handlePhoneLogin))
    return

  try {
    uni.showLoading({ title: '登录中...' })

    // 调用短信验证码登录接口
    await tokenStore.smsLogin({
      phone: phone.value,
      code: code.value,
    })

    // 清除倒计时
    if (timer) {
      clearInterval(timer)
      timer = null
    }

    // 登录成功后返回原页面（或首页）
    navigateAfterLogin()
  }
  catch (error: any) {
    console.error('手机号登录失败:', error)

    // 处理手机号关联多账号的情况（code=2004）
    if (error instanceof MultiAccountError) {
      const { authTicket, accountList } = error.data
      // 清除倒计时
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      const userStore = useUserStore()
      userStore.authTicket = authTicket
      userStore.accountList = accountList

      // 跳转到切换账号页面
      uni.redirectTo({
        url: `/pages/me/switchAccount`,
      })
      return
    }

    // 提取错误信息并弹出 Toast
    let errMsg = error?.data?.message || error?.data?.msg || error?.message || error?.msg || (typeof error === 'string' ? error : '网络异常，请重试')
    if (errMsg.startsWith('Error: ')) {
      errMsg = errMsg.replace('Error: ', '')
    }
    setTimeout(() => {
      showCustomToast({ title: errMsg, icon: 'none', duration: TOAST_DURATION_MS })
    }, TOAST_AFTER_LOADING_DELAY_MS)
  }
  finally {
    uni.hideLoading()
  }
}

const { navToAgreement } = useSystemConfig()

// 页面卸载时清理定时器
onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})
</script>

<style lang="scss" scoped>
.login-container {
  min-height: 100vh;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo-box {
  width: 750rpx;
  height: 686rpx;
  display: flex;
  justify-content: center;

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

.btn-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #333;
  color: #fff;
  border: none;
  border-radius: 48rpx;
  height: 96rpx;
  font-size: 32rpx;
  font-weight: 500;
  margin-top: 60rpx;

  &.disabled {
    background-color: #f5f5f5;
    color: #999999;
  }
}

.input-group {
  display: flex;
  align-items: center;
  background-color: #f6f6f6;
  border-radius: 48rpx;
  height: 96rpx;
  margin-bottom: 32rpx;
  padding: 0 40rpx;
  border: 2rpx solid transparent;
  box-sizing: border-box;
  transition: all 0.3s ease;

  &.has-input {
    background-color: #ffffff;
    border-color: #333;
  }

  .prefix {
    font-size: 32rpx;
    color: #181818;
    font-weight: 500;
    flex-shrink: 0;
  }

  .divider {
    width: 2rpx;
    height: 32rpx;
    background-color: #e5e5e5;
    margin: 0 24rpx;
  }

  .input-item {
    flex: 1;
    height: 100%;
    font-size: 30rpx;
    color: #333;
    background: transparent;
  }

  .code-text {
    font-size: 28rpx;
    color: #181818;
    font-weight: 500;
    flex-shrink: 0;

    &.disabled {
      color: #999;
      font-weight: 400;
    }
  }

  .clear-btn {
    width: 32rpx;
    height: 32rpx;
    background-color: #cccccc;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 20rpx;

    .clear-text {
      color: #ffffff;
      font-size: 20rpx;
      line-height: 1;
    }
  }
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
</style>
