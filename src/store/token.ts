import type {
  ILoginForm,
} from '@/api/login'
import type { IDoubleTokenRes } from '@/api/types/login'
import { defineStore } from 'pinia'
import { computed, nextTick, ref } from 'vue'
import {
  douYinMpLogin as _douYinMpLogin,
  douYinMpPhoneLogin as _douYinMpPhoneLogin,
  login as _login,
  logout as _logout,
  refreshToken as _refreshToken,
  selectAccount as _selectAccount,
  smsLogin as _smsLogin,
  switchAccountLogin as _switchAccountLogin,
  wxMpPhoneLogin as _wxMpPhoneLogin,
  // getWxCode,
} from '@/api/login'
import { showCustomToast } from '@/composables/useCustomToast'
import { useUserStore } from './user'

// 初始化状态（双 token 模式）
const tokenInfoState: IDoubleTokenRes = {
  accessToken: '',
  accessExpiresIn: 0,
  refreshToken: '',
  refreshExpiresIn: 0,
}

export const useTokenStore = defineStore(
  'token',
  () => {
    // 定义 token 信息
    const tokenInfo = ref<IDoubleTokenRes>({ ...tokenInfoState })

    // 设置 token 信息
    const setTokenInfo = (val: IDoubleTokenRes) => {
      tokenInfo.value = val
      console.log('setTokenInfo - 存储token:', val)
    }

    /**
     * 登录成功后处理逻辑
     * @param tokenInfo 登录返回的token信息
     */
    async function _postLogin(tokenInfo: IDoubleTokenRes) {
      console.log('_postLogin - 接收到token:', tokenInfo)

      // 存储 token
      setTokenInfo(tokenInfo)

      // 等待 Vue 响应式更新完成，确保 token 已经存储到 store
      await nextTick()

      // 再次确认 token 已经存在
      if (!tokenInfo.accessToken) {
        console.error('Token 存储失败')
        throw new Error('Token 存储失败')
      }

      console.log('Token 存储成功，开始获取用户信息')

      // 获取用户信息
      const userStore = useUserStore()
      await userStore.fetchUserInfo()
    }

    /**
     * 用户登录
     * 有的时候后端会用一个接口返回token和用户信息，有的时候会分开2个接口，一个获取token，一个获取用户信息
     * （各有利弊，看业务场景和系统复杂度），这里使用2个接口返回的来模拟
     * @param loginForm 登录参数
     * @returns 登录结果
     */
    const login = async (loginForm: ILoginForm) => {
      try {
        const res = await _login(loginForm)
        console.log('普通登录-res: ', res)
        await _postLogin(res)
        showCustomToast({
          title: '登录成功',
          icon: 'success',
        })
        return res
      }
      catch (error: any) {
        console.error('登录失败:', error)
        const { networkType } = await uni.getNetworkType()
        console.log('networkTypenetworkType--', networkType)
        showCustomToast({
          title: '网络异常，请重试',
          icon: 'error',
        })
        throw error
      }
      finally {
        // 登录完成
      }
    }

    /**
     * 微信登录
     * 有的时候后端会用一个接口返回token和用户信息，有的时候会分开2个接口，一个获取token，一个获取用户信息
     * （各有利弊，看业务场景和系统复杂度），这里使用2个接口返回的来模拟
     * @param data 包含 loginCode, phoneCode
     * @returns 登录结果
     */
    const wxLogin = async (data: { loginCode: string, phoneCode: string }) => {
      try {
        console.log('微信登录-data: ', data)
        const res = await _wxMpPhoneLogin(data)
        console.log('微信登录-res: ', res)
        await _postLogin(res)
        showCustomToast({
          title: '登录成功',
          icon: 'success',
        })
        return res
      }
      catch (error: any) {
        console.error('微信登录失败:', error)
        const { networkType } = await uni.getNetworkType()
        showCustomToast({
          title: networkType === 'none' ? '网络异常，请重试' : '微信登录失败，请重试',
          icon: 'error',
        })
        throw error
      }
      finally {
        // 登录完成
      }
    }

    /**
     * 抖音小程序端授权登录
     * @param data 包含 code, encryptedData, iv
     * @returns 登录结果
     */
    const douYinMpLogin = async (data: { code: string, encryptedData: string, iv: string }) => {
      try {
        console.log('抖音登录-data: ', data)
        const res = await _douYinMpLogin(data)
        console.log('抖音登录-res: ', res)
        await _postLogin(res)
        showCustomToast({
          title: '登录成功',
          icon: 'success',
        })
        return res
      }
      catch (error: any) {
        console.error('抖音登录失败:', error)
        const { networkType } = await uni.getNetworkType()
        showCustomToast({
          title: networkType === 'none' ? '网络异常，请重试' : '抖音登录失败，请重试',
          icon: 'error',
        })
        throw error
      }
      finally {
        // 登录完成
      }
    }

    /**
     * 抖音小程序端手机号授权登录
     * @param code 获取手机号的凭证code
     * @returns 登录结果
     */
    const douYinMpPhoneLogin = async (code: string) => {
      try {
        console.log('抖音手机号登录-code: ', code)
        const res = await _douYinMpPhoneLogin({ code })
        console.log('抖音手机号登录-res: ', res)
        await _postLogin(res)
        showCustomToast({
          title: '登录成功',
          icon: 'success',
        })
        return res
      }
      catch (error: any) {
        console.error('抖音手机号登录失败:', error)
        const { networkType } = await uni.getNetworkType()
        showCustomToast({
          title: networkType === 'none' ? '网络异常，请重试' : '抖音手机号登录失败，请重试',
          icon: 'error',
        })
        throw error
      }
      finally {
        // 登录完成
      }
    }

    /**
     * 短信验证码登录
     * @param data 包含手机号和验证码
     * @returns 登录结果，如果手机号关联多账号则抛出 MultiAccountError
     */
    const smsLogin = async (data: { phone: string, code: string }) => {
      // 直接调用 _smsLogin，如果抛出 MultiAccountError，由调用方（phone.vue）自行处理
      const res = await _smsLogin(data)
      console.log('短信登录-res: ', res)
      await _postLogin(res)
      showCustomToast({
        title: '登录成功',
        icon: 'success',
      })
      return res
    }

    /**
     * 选择账号登录（手机号关联多账号时使用）
     * @param data 包含 authTicket 和 accountId
     * @returns 登录结果
     */
    const selectAccountLogin = async (data: { authTicket: string, accountId: string | number }) => {
      try {
        console.log('选择账号登录-data: ', data)
        const res = await _selectAccount(data)
        console.log('选择账号登录-res: ', res)
        await _postLogin(res)
        const userStore = useUserStore()
        userStore.updateCurrentAccountLocally(data.accountId)
        showCustomToast({
          title: '登录成功',
          icon: 'success',
        })
        return res
      }
      catch (error) {
        console.error('选择账号登录失败:', error)
        throw error
      }
    }

    /**
     * 切换账号登录（已登录状态下使用）
     * @param data 包含 targetAccountId
     */
    const switchAccountLoginStore = async (data: { targetAccountId: string | number }) => {
      try {
        console.log('切换账号登录-data: ', data)
        const res = await _switchAccountLogin(data)
        console.log('切换账号登录-res: ', res)
        await _postLogin(res)
        const userStore = useUserStore()
        userStore.updateCurrentAccountLocally(data.targetAccountId)
        showCustomToast({
          title: '切换成功',
          icon: 'success',
        })
        return res
      }
      catch (error) {
        console.error('切换账号登录失败:', error)
        throw error
      }
    }

    /**
     * 退出登录 并 删除用户信息
     * 使用模块级变量防止 http.ts 错误处理再次触发 logout，形成死循环
     */
    let _isLoggingOut = false
    const logout = async () => {
      // 防重入：如果已经在 logout 流程中，直接返回（http.ts 错误处理会触发这里）
      if (_isLoggingOut) {
        console.log('logout - 已在退出流程中，跳过重复调用')
        return
      }
      _isLoggingOut = true
      try {
        const { networkType } = await uni.getNetworkType()
        if (networkType !== 'none') {
          // 有网络，调用退出登录接口
          await _logout()
        }
        else {
          console.log('logout - 无网络，直接清除本地信息')
        }
      }
      catch (error) {
        // 退出接口失败（包括token无效等），忽略错误，继续清除本地状态
        console.error('退出登录接口调用失败（忽略）:', error)
      }
      finally {
        _isLoggingOut = false
        // 无论成功失败，都需要清除本地token信息
        console.log('退出登录-清除用户信息')
        tokenInfo.value = { ...tokenInfoState }
        uni.removeStorageSync('token')
        const userStore = useUserStore()
        userStore.clearUserInfo()
      }
    }

    /**
     * 刷新token
     * @returns 刷新结果
     */
    const refreshToken = async () => {
      try {
        // 安全检查，确保refreshToken存在
        if (!tokenInfo.value?.refreshToken) {
          throw new Error('无效的refreshToken')
        }

        const oldRefreshToken = tokenInfo.value.refreshToken
        const oldRefreshExpiresIn = tokenInfo.value.refreshExpiresIn

        // 调用刷新 token 接口
        const res = await _refreshToken(oldRefreshToken)
        console.log('刷新token-res: ', res)

        // 更新 token 信息（保留原有的 refreshToken）
        const newTokenInfo: IDoubleTokenRes = {
          accessToken: res.accessToken,
          accessExpiresIn: res.expiresIn,
          refreshToken: oldRefreshToken,
          refreshExpiresIn: oldRefreshExpiresIn,
        }

        setTokenInfo(newTokenInfo)
        return res
      }
      catch (error) {
        console.error('刷新token失败:', error)
        throw error
      }
    }

    /**
     * 获取有效的 token
     */
    const getValidToken = computed(() => {
      if (!tokenInfo.value || !tokenInfo.value.accessToken) {
        return ''
      }
      return tokenInfo.value.accessToken
    })

    /**
     * 判断用户是否已登录
     */
    const hasLogin = computed(() => {
      return !!tokenInfo.value?.accessToken
    })

    return {
      // 核心状态
      tokenInfo,

      // 核心API方法
      login,
      wxLogin,
      douYinMpLogin,
      douYinMpPhoneLogin,
      smsLogin,
      selectAccountLogin,
      switchAccountLoginStore,
      logout,
      refreshToken,

      // 认证状态判断
      hasLogin,
      validToken: getValidToken,

      // 工具方法
      setTokenInfo,
    }
  },
  {
    // 添加持久化配置，确保刷新页面后token信息不丢失
    persist: true,
  },
)
